module.exports = {
    validateApiKey: (allowedApiKey) => (req, res, next) => {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey || allowedApiKey !== apiKey) {
            return res.status(401).json({ message: "Unauthorized: Invalid API Key." });
        }
        next();
    }
}