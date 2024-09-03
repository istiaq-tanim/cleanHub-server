const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URL
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function run() {
    try {
        // Connect to MongoDB
        // await client.connect();
        console.log("Connected to MongoDB");

        const db = client.db('cleanHub');
        const users = db.collection('users');
        const products = db.collection('products');

        // User Registration
        app.post('/api/v1/register', async (req, res) => {
            const { name, email, password } = req.body;

            // Check if email already exists
            const existingUser = await users.findOne({ email });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'User already exists'
                });
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert user into the database
            await users.insertOne({ name, email, password: hashedPassword, role: "USER" });

            res.status(201).json({
                success: true,
                message: 'User registered successfully'
            });
        });

        // User Login
        app.post('/api/v1/login', async (req, res) => {
            const { email, password } = req.body;

            // Find user by email
            const user = await users.findOne({ email });
            if (!user) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            // Compare hashed password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            // Generate JWT token
            const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.EXPIRES_IN });

            res.json({
                success: true,
                message: 'Login successful',
                token
            });
        });

        app.get("/dishWashing-items", async (req, res) => {
            const query = req.query
            let filter = { $and: [] }
            if (query?.rating) {
                const ratings = query.rating.split("|").map(item => parseInt(item, 10))
                filter.$and.push({ rating: { $in: ratings } })
            };

            if (query?.category) {
                const categories = query.category.split("|").map(item => ({
                    category: { $regex: new RegExp(item, "i") }
                }))
                filter.$and.push({ $or: categories });
            }

            if (query?.price) {
                const priceRanges = query.price.split("|").map(range => {
                    const [min, max] = range.split("-").map(Number);
                    return { price: { $gte: min, $lte: max } };
                });
                filter.$and.push({ $or: priceRanges });
            }

            if (filter.$and.length === 0) {
                delete filter.$and;
            }
            const data = await products.find(filter).toArray()

            res.status(201).json({
                success: true,
                message: 'Products is Fetching',
                data
            });

        })
        app.get("/dishWashing-items/:id", async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const data = await products.findOne(query)
            res.status(201).json({
                success: true,
                message: 'Single Product is Fetching',
                data
            });

        })

        app.get("/flash-sale", async (req, res) => {
            const query = { flashSale: true }
            const data = await products.find(query).sort({ created_at: 1 }).toArray()

            res.status(201).json({
                success: true,
                message: 'Flash Sale is Fetching',
                data
            });

        })

        app.get("/trending-product", async (req, res) => {
            const data = await products.find().sort({ rating: -1 }).limit(6).toArray()
            res.status(201).json({
                success: true,
                message: 'Trending Product is Fetching',
                data
            });
        })

        app.post("/addProduct", async (req, res) => {
            const product = req.body
            const data = await products.insertOne(product)
            res.status(201).json({
                success: true,
                message: 'Product is Created',
                data
            });
        })

        app.delete("/product/:id", async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await products.deleteOne(query)
            res.status(201).json({
                success: true,
                message: 'Product is Deleted',
            });
        })

        app.put("/product/:id", async (req, res) => {
            const id = req.params.id
            const updatedProduct = req.body
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updateProduct = { $set: updatedProduct }

            const result = await products.updateOne(filter, updateProduct, options)
            res.status(201).json({
                success: true,
                message: 'Product is Deleted',
                result
            });
        })

        // Start the server
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });

    } finally {
    }
}

run().catch(console.dir);

// Test route
app.get('/', (req, res) => {
    const serverStatus = {
        message: 'Server is running smoothly',
        timestamp: new Date()
    };
    res.json(serverStatus);
});