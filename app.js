const express = require('express');
const cors = require('cors');

// Import des routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const productKeyRoutes = require('./routes/productKey');
const notificationRoutes = require("./routes/notificationRoutes");
const locationRoutes = require("./routes/locationRoutes");
const ParameterRoutes=require("./routes/parameteerRoutes") ; 
const chatRoutes = require('./routes/chatRoutes');
const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/product-keys', productKeyRoutes); 
app.use('/user', userRoutes);
app.use("/notifications", notificationRoutes);
app.use("/locations" , locationRoutes) ; 
app.use('/settings',ParameterRoutes) ; 
app.use('/chat', chatRoutes)
module.exports = app;
