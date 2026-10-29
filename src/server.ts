import 'dotenv/config';
import express from 'express';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);

app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`);
});
