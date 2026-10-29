require('dotenv').config();
const express = require('express');
const authRoutes = require('./routes/auth');
const requireAuth = require('./middleware/auth');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = 3000;

// tell express to parse JSON request bundles
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes)

require('./db'); // initialises the database

app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`);
});

app.get('/protected', requireAuth, (req, res) => {
    res.json({ message: 'You are authenticated', userId: req.user.id });
});