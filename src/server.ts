import 'dotenv/config';
import express from 'express';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import chatRoutes from './routes/chat.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/chat', chatRoutes);

app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`);
});
