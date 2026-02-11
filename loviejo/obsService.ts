import OBSWebSocket from 'obs-websocket-js';
import { StreamState, StreamOutput, StreamStats, Scene, AudioSource, SceneItem, Transition } from '../types';
import { relayService } from './relayService';

const obs = new OBSWebSocket();

// State
let lastBytes = 0;
let lastTimestamp = Date.now();
let relayModeId: string | null = null; // Si no es null, usamos Relay HTTP

const mapStreamState = (active: boolean, reconnecting: boolean): StreamState => {
    if (reconnecting) return StreamState.STARTING;
    return active ? StreamState.LIVE : StreamState.OFFLINE;
};

export const obsService = {
    connect: async (ip: string, port: string, password?: string, strategy: string = 'auto') => {
        // Reset state
        relayModeId = null;

        // Detectar si es Relay Mode (ID sin puntos o estrategia explícita) o Cloud Mode (ID@IP)
        const isCloudMagic = ip.includes('@');
        const isRelay = strategy === 'relay' || !ip.includes('.') || isCloudMagic;

        if (isRelay) {
            let targetId = ip;
            let targetIp = '';

            // Sintaxis Mágica: ID@IP (Cloud Connect)
            if (isCloudMagic) {
                const parts = ip.split('@');
                targetId = parts[0];
                targetIp = parts[1];
                console.log(`[OBS Service] Detectado Modo Nube: ID=${targetId}, IP Destino=${targetIp}`);
            } else {
                console.log(`[OBS Service] Iniciando Modo Relay (Agente Local) para ID: ${targetId}`);
            }

            try {
                if (isCloudMagic) {
                    // Modo Nube: Pedimos al backend que se conecte
                    await relayService.connectRemoteObs(targetId, targetIp, port || '4455', password);
                } else {
                    // Modo Agente: Verificamos si ya está conectado
                    const isConnected = await relayService.checkStatus(targetId);
                    if (!isConnected) throw new Error("El Agente OBS no está conectado. Si no usas Agente, usa el formato ID@IP_PUBLICA");
                }

                relayModeId = targetId; // Activar modo Relay
                return true;
            } catch (e: any) {
                console.error("[OBS Relay] Error:", e);
                throw new Error(e.message || "Error conectando al Relay.");
            }
        }

        // --- MODO CLÁSICO (WebSocket Directo) ---
        // Sanitize inputs internally to be fail-safe
        ip = (ip || "").trim();
        port = (port || "").trim();
        const cleanPassword = (password || "").trim();

        if (!ip) throw new Error("Dirección del servidor requerida");

        // Limpiar el host de protocolos previos si el usuario los pegó
        let host = ip.replace(/^(wss?:\/\/|https?:\/\/|http:\/\/)/, '').replace(/\/$/, '');

        const isSecureSite = window.location.protocol === 'https:';
        // const isLocal = host === 'localhost' || host.startsWith('192.168.') || host === '127.0.0.1' || host.startsWith('10.');

        let protocol = isSecureSite ? 'wss' : 'ws';
        let targetPort = port || '4455';

        // Lógica específica para Túneles (Cloudflare/Ngrok siempre usan 443/SSL)
        if (host.includes('trycloudflare.com') || host.includes('ngrok-free.app') || host.includes('ngrok.io')) {
            protocol = 'wss';
            targetPort = '443';
        }

        // NORMALIZACIÓN CRÍTICA PARA SAFARI/iOS:
        let url = "";
        if ((protocol === 'wss' && targetPort === '443') || (protocol === 'ws' && targetPort === '80')) {
            url = `${protocol}://${host}`;
        } else {
            url = `${protocol}://${host}:${targetPort}`;
        }

        console.log(`[OBS] Intentando conectar a: ${url}`);

        try {
            const pConnect = obs.connect(url, cleanPassword);
            const pTimeout = new Promise((_, r) => setTimeout(() => r(new Error("TIMEOUT")), 20000));
            await Promise.race([pConnect, pTimeout]);
            await obs.call('GetVersion');
            return true;
        } catch (e: any) {
            const msg = e.message || e.toString();
            console.error("[OBS] Error de conexión:", msg);
            if (msg.includes("SecurityError") || msg.includes("Insecure context")) {
                throw new Error("Bloqueo de Seguridad: iOS no permite conectar a 'ws' (inseguro) desde una web 'https'. Usa un túnel SSL (Cloudflare/Ngrok).");
            }
            if (msg === 'TIMEOUT') {
                throw new Error("Tiempo agotado. Verifica que OBS esté abierto y el puerto/túnel configurado correctamente.");
            }
            if (e.code === 4009) throw new Error("Contraseña de OBS incorrecta.");
            throw new Error(`Error: ${msg}`);
        }
    },

    disconnect: () => {
        relayModeId = null;
        try { obs.disconnect(); } catch (e) { }
    },

    isRelayMode: () => !!relayModeId,

    on: (e: any, cb: any) => {
        // En Relay Mode no hay eventos push en tiempo real por ahora
        if (!relayModeId) obs.on(e, cb);
    },
    off: (e: any, cb: any) => {
        if (!relayModeId) obs.off(e, cb);
    },

    // --- MÉTODOS UNIFICADOS (Relay o Directo) ---

    getScenes: async (): Promise<Scene[]> => {
        try {
            let r;
            if (relayModeId) {
                // Pedimos al Relay
                r = await relayService.sendRequest(relayModeId, 'GetSceneList');
            } else {
                // Pedimos directo
                r = await obs.call('GetSceneList');
            }

            if (!r || !r.scenes) return [];

            return (r.scenes as any[]).map((s: any) => ({
                id: s.sceneName,
                name: s.sceneName,
                isActive: s.sceneName === r.currentProgramSceneName,
                type: 'generic' as const
            })).reverse();
        } catch (e) {
            console.error("Error fetching scenes:", e);
            return [];
        }
    },

    getAudioSources: async (): Promise<AudioSource[]> => {
        try {
            let r;
            if (relayModeId) {
                r = await relayService.sendRequest(relayModeId, 'GetInputList');
            } else {
                r = await obs.call('GetInputList');
            }

            if (!r || !r.inputs) return [];

            const list: AudioSource[] = [];

            // LISTA BLANCA: Solo mostrar fuentes que contengan estas palabras clave
            const allowedKeywords = ['SRT', 'SRTLA', 'RTMP'];

            const filteredInputs = r.inputs.filter((i: any) =>
                allowedKeywords.some(key => (i.inputName as string).toUpperCase().includes(key))
            );

            // Fetch details in PARALLEL to avoid N * RTT latency
            const results = await Promise.all(filteredInputs.map(async (i: any) => {
                const name = i.inputName as string;
                let mute = { inputMuted: false };
                let vol = { inputVolumeMul: 1 };

                try {
                    if (relayModeId) {
                        try {
                            const [m, v] = await Promise.all([
                                relayService.sendRequest(relayModeId, 'GetInputMute', { inputName: name }),
                                relayService.sendRequest(relayModeId, 'GetInputVolume', { inputName: name })
                            ]);
                            mute = m;
                            vol = v;
                        } catch (e) { console.warn(`Failed to fetch mute/vol for ${name} in relay`, e); }
                    } else {
                        const [m, v] = await Promise.all([
                            obs.call('GetInputMute', { inputName: name }),
                            obs.call('GetInputVolume', { inputName: name })
                        ]);
                        mute = m;
                        vol = v;
                    }

                    return {
                        id: name,
                        name,
                        isMuted: mute.inputMuted,
                        volume: Math.cbrt(vol.inputVolumeMul as number) * 100,
                        status: 'Online'
                    } as AudioSource;
                } catch { return null; }
            }));

            return results.filter((x): x is AudioSource => x !== null);
        } catch { return []; }
    },

    getCurrentStreamState: async (): Promise<StreamState> => {
        // En Relay no sabemos el estado inicial sin preguntar al agente (TODO)
        // Asumimos OFFLINE por defecto hasta que el usuario toque algo
        if (relayModeId) return StreamState.OFFLINE;

        try {
            const status = await obs.call('GetStreamStatus');
            return mapStreamState(status.outputActive, status.outputReconnecting);
        } catch { return StreamState.OFFLINE; }
    },

    getStreamStats: async (): Promise<StreamStats> => {
        if (relayModeId) {
            const s = await relayService.getStats(relayModeId);
            if (!s) return { cpu: 0, fps: 0, memory: 0, dropped: 0, droppedFrames: 0, totalFrames: 0, uptime: "Cloud Mode", diskSpace: 0, kbitsPerSec: 0 };

            // Calculo de Bitrate Local
            let kbitsPerSec = 0;
            if (s.streaming && s.outputBytes) {
                const now = Date.now();
                const timeDiff = (now - lastTimestamp) / 1000;
                if (timeDiff > 0 && lastBytes > 0) { // Solo si tenemos un punto anterior válido
                    const bits = (s.outputBytes - lastBytes) * 8;
                    kbitsPerSec = (bits / timeDiff) / 1000;
                }
                lastBytes = s.outputBytes;
                lastTimestamp = now;
            } else { lastBytes = 0; }

            return {
                cpu: s.cpu,
                fps: s.fps,
                memory: s.memory,
                droppedFrames: s.droppedFrames,
                dropped: s.droppedFrames, // Alias
                totalFrames: s.totalFrames,
                uptime: s.uptime,
                diskSpace: 0, // No lo manda la API por defecto
                kbitsPerSec: Math.round(kbitsPerSec > 0 ? kbitsPerSec : 0)
            };
        }
        try {
            const s = await obs.call('GetStats');
            let uptime = "00:00:00";
            let kbitsPerSec = 0;

            try {
                const st = await obs.call('GetStreamStatus');
                if (st.outputActive) {
                    uptime = st.outputTimecode;
                    const now = Date.now();
                    const timeDiff = (now - lastTimestamp) / 1000;
                    if (timeDiff > 0) {
                        const bits = (st.outputBytes - lastBytes) * 8;
                        kbitsPerSec = (bits / timeDiff) / 1000;
                        lastBytes = st.outputBytes;
                        lastTimestamp = now;
                    }
                } else { lastBytes = 0; }
            } catch { lastBytes = 0; }

            return {
                cpu: s.cpuUsage, fps: s.activeFps, memory: s.memoryUsage,
                droppedFrames: s.outputSkippedFrames, totalFrames: s.outputTotalFrames,
                uptime, diskSpace: s.availableDiskSpace, kbitsPerSec: Math.round(kbitsPerSec)
            };
        } catch { throw new Error("No conectado"); }
    },

    getPreviewScreenshot: async (name: string) => {
        if (relayModeId) {
            return await relayService.getPreview(relayModeId, name);
        }
        try {
            const r = await obs.call('GetSourceScreenshot', { sourceName: name, imageFormat: 'jpg', imageWidth: 480, imageCompressionQuality: 30 });
            return r.imageData;
        } catch { return null; }
    },

    toggleStream: async (state: StreamState) => {
        if (relayModeId) {
            if (state === StreamState.LIVE) return await relayService.stopStream(relayModeId);
            else return await relayService.startStream(relayModeId);
        }
        if (state === StreamState.LIVE) await obs.call('StopStream');
        else await obs.call('StartStream');
    },

    toggleMute: async (name: string, currentMuteState: boolean) => {
        if (relayModeId) {
            return currentMuteState ? await relayService.unmute(relayModeId, name) : await relayService.mute(relayModeId, name);
        }
        return obs.call('SetInputMute', { inputName: name, inputMuted: !currentMuteState });
    },

    setVolume: async (name: string, vol: number) => {
        const volumeMul = Math.pow(vol / 100, 3);
        if (relayModeId) {
            return await relayService.sendCommand(relayModeId, 'SetInputVolume', { inputName: name, inputVolumeMul: volumeMul });
        }
        return obs.call('SetInputVolume', { inputName: name, inputVolumeMul: volumeMul });
    },

    restartSource: async (name: string) => {
        if (relayModeId) {
            try {
                // 1. Obtener escena y items via Relay
                const s: any = await relayService.sendRequest(relayModeId, 'GetCurrentProgramScene');
                const items: any = await relayService.sendRequest(relayModeId, 'GetSceneItemList', { sceneName: s.currentProgramSceneName });

                // 2. Buscar Item ID
                console.log(`[Relay] Restarting source ${name}`);
                try {
                    // PRIMERO: Intentar reiniciar como medio (SRT/RTMP/Video)
                    await relayService.sendCommand(relayModeId, 'RestartMedia', { inputName: name });
                    return;
                } catch (e: any) {
                    // Si falla (no es media source), intentamos fallback a toggle visibility
                    console.warn("Relay RestartMedia failed, trying visibility toggle", e);
                }

                // Fallback Relay: Toggle Visibility (esto es más complejo en Relay porque necesitamos la escena actual remota)
                // Por simplicidad, por ahora asumimos que RestartMedia funciona para lo que el usuario quiere (ingest sources)
                return;
            } catch (e) {
                console.error("Error restarting source in Relay mode:", e);
                return;
            }
        }
        try {
            console.log(`[Local] Restarting source ${name}`);
            // PRIMERO: Intentar comando nativo de reinicio de media
            await obs.call('RestartMedia' as any, { inputName: name });
            console.log(`[Local] RestartMedia success for ${name}`);
        } catch (e) {
            console.log(`[Local] RestartMedia not supported for ${name}, trying visibility toggle...`);
            // FALLBACK: Toggle Visibility
            try {
                const s = await obs.call('GetCurrentProgramScene');
                const items = await obs.call('GetSceneItemList', { sceneName: s.currentProgramSceneName });
                const item = (items.sceneItems as any[]).find(i => i.sourceName === name);

                if (item) {
                    await obs.call('SetSceneItemEnabled', { sceneName: s.currentProgramSceneName, sceneItemId: item.sceneItemId as number, sceneItemEnabled: false });
                    await new Promise(r => setTimeout(r, 500)); // Breve pausa
                    await obs.call('SetSceneItemEnabled', { sceneName: s.currentProgramSceneName, sceneItemId: item.sceneItemId as number, sceneItemEnabled: true });
                }
            } catch (err) { console.error("Fallback restart failed", err); }
        }
    },

    switchScene: async (name: string) => {
        if (relayModeId) return await relayService.setScene(relayModeId, name);
        return obs.call('SetCurrentProgramScene', { sceneName: name });
    },

    getProfiles: async () => {
        if (relayModeId) {
            try {
                const r: any = await relayService.sendRequest(relayModeId, 'GetProfileList');
                return { current: r.currentProfileName, list: r.profiles };
            } catch { return { current: '', list: [] }; }
        }
        try {
            const r = await obs.call('GetProfileList');
            return { current: r.currentProfileName, list: r.profiles };
        } catch { return { current: '', list: [] }; }
    },

    setProfile: async (name: string) => {
        if (relayModeId) return await relayService.sendCommand(relayModeId, 'SetCurrentProfile', { profileName: name });
        return obs.call('SetCurrentProfile', { profileName: name });
    },

    getVideoSettings: async () => {
        if (relayModeId) return null;
        try {
            const v = await obs.call('GetVideoSettings');
            return { ...v, bitrate: 6000 };
        } catch { return null; }
    },

    setVideoSettings: async (settings: any) => { if (!relayModeId) obs.call('SetVideoSettings', settings); },

    setStreamBitrate: async (bitrateKbps: number) => {
        if (relayModeId) {
            try {
                const rid = relayModeId; // Capture for closure
                const list: any = await relayService.sendRequest(rid, 'GetOutputList');
                const names = (list.outputs as any[]).map(o => o.outputName);

                // Ejecutar en paralelo para todas las salidas
                await Promise.all(names.map(async (name) => {
                    try {
                        await relayService.sendCommand(rid, 'SetOutputSettings', {
                            outputName: name,
                            outputSettings: { bitrate: bitrateKbps, video_bitrate: bitrateKbps }
                        });
                    } catch { /* Ignoramos errores individuales */ }
                }));
                return true;
            } catch (e) {
                console.error("[OBS Relay] Error setting bitrate:", e);
                return false;
            }
        }
        try {
            const list = await obs.call('GetOutputList');
            const names = (list.outputs as any[]).map(o => o.outputName);
            for (const name of names) {
                obs.call('SetOutputSettings', { outputName: name, outputSettings: { bitrate: bitrateKbps, video_bitrate: bitrateKbps } }).catch(() => { });
            }
            return true;
        } catch { return false; }
    },

    setStudioMode: async (e: boolean) => {
        if (relayModeId) return await relayService.sendCommand(relayModeId, 'SetStudioModeEnabled', { studioModeEnabled: e });
        obs.call('SetStudioModeEnabled', { studioModeEnabled: e });
    },

    getStudioModeEnabled: async () => {
        if (relayModeId) {
            try { return (await relayService.sendRequest(relayModeId, 'GetStudioModeEnabled')).studioModeEnabled; } catch { return false; }
        }
        return (await obs.call('GetStudioModeEnabled')).studioModeEnabled;
    },

    setPreviewScene: async (n: string) => {
        if (relayModeId) return await relayService.sendCommand(relayModeId, 'SetCurrentPreviewScene', { sceneName: n });
        obs.call('SetCurrentPreviewScene', { sceneName: n });
    },

    triggerTransition: async () => {
        if (relayModeId) return await relayService.sendCommand(relayModeId, 'TriggerStudioModeTransition');
        obs.call('TriggerStudioModeTransition');
    },

    getTransitions: async () => {
        if (relayModeId) {
            try {
                const r: any = await relayService.sendRequest(relayModeId, 'GetSceneTransitionList');
                return r.transitions.map((t: any) => ({ name: t.transitionName, kind: t.transitionKind, fixed: t.transitionFixed }));
            } catch { return []; }
        }
        return (await obs.call('GetSceneTransitionList')).transitions.map((t: any) => ({ name: t.transitionName, kind: t.transitionKind, fixed: t.transitionFixed }));
    },

    getSceneItems: async (n: string) => {
        if (relayModeId) {
            try {
                const r: any = await relayService.sendRequest(relayModeId, 'GetSceneItemList', { sceneName: n });
                return (r.sceneItems as any[]).map(i => ({ itemId: i.sceneItemId, sourceName: i.sourceName, isEnabled: i.sceneItemEnabled, type: i.inputKind || 'source', isGroup: i.isGroup || false, children: [] }));
            } catch { return []; }
        }
        const r = await obs.call('GetSceneItemList', { sceneName: n });
        return (r.sceneItems as any[]).map(i => ({ itemId: i.sceneItemId, sourceName: i.sourceName, isEnabled: i.sceneItemEnabled, type: i.inputKind || 'source', isGroup: i.isGroup || false, children: [] }));
    },

    toggleSceneItem: async (s: string, id: number, e: boolean) => {
        if (relayModeId) return await relayService.sendCommand(relayModeId, 'SetSceneItemEnabled', { sceneName: s, sceneItemId: id, sceneItemEnabled: e });
        obs.call('SetSceneItemEnabled', { sceneName: s, sceneItemId: id, sceneItemEnabled: e });
    },

    setCurrentTransition: async (name: string) => {
        if (relayModeId) return await relayService.sendCommand(relayModeId, 'SetCurrentSceneTransition', { transitionName: name });
        obs.call('SetCurrentSceneTransition', { transitionName: name });
    },

    getRelayState: async () => {
        if (!relayModeId) return null;
        try {
            const sceneP = relayService.sendRequest(relayModeId, 'GetCurrentProgramScene');
            const [sceneData, streamData] = await Promise.all([
                sceneP,
                relayService.sendRequest(relayModeId, 'GetStreamStatus')
            ]);

            return {
                currentScene: sceneData?.currentProgramSceneName,
                isStreaming: streamData?.outputActive
            };
        } catch (e) {
            console.error("Error polling relay:", e);
            return null;
        }
    }
};
