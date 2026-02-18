module.exports = function registerHealthRoutes({ app, db }) {
    app.get('/api/health', async (req, res) => {
        try {
            await db.queryOne('SELECT 1');
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        } catch (error) {
            res.status(503).json({ status: 'error', message: 'Database unavailable' });
        }
    });
};

