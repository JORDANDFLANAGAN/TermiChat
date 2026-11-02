import 'dotenv/config';
import express from 'express';
import db from './db.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import chatRoutes, { closeAllConnections } from './routes/chat.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/chat', chatRoutes);

const server = app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`);
});

function shutdown() {
    closeAllConnections();
    server.close(() => {
        db.close();
        process.exit(0);
    });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
