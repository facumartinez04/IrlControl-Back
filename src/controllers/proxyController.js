import axios from 'axios';

class ProxyController {
    async proxy(req, res) {
        try {
            const { url } = req.query;

            if (!url) {
                return res.status(400).json({ error: 'URL parameter is required' });
            }

            // Decode the URL in case it's encoded
            const decodedUrl = decodeURIComponent(url);

            console.log(`Proxying request to: ${decodedUrl}`);

            const response = await axios.get(decodedUrl, {
                // Forward some headers if necessary, but keep it simple for now
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            // Return the data exactly as received
            return res.status(response.status).send(response.data);
        } catch (error) {
            console.error('Proxy Error:', error.message);
            if (error.response) {
                return res.status(error.response.status).json({
                    error: 'External API Error',
                    message: error.response.data
                });
            }
            return res.status(500).json({ error: error.message });
        }
    }
}

const proxyController = new ProxyController();
export default proxyController;
