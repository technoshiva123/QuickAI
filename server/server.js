import 'dotenv/config'
import express from 'express' 
import cors from 'cors'
import { clerkMiddleware, requireAuth } from '@clerk/express'
import aiRouter from './routes/aiRoutes.js'
import connectCloudinary from './configs/cloudinary.js'
import userRouter from './routes/userRoutes.js'

const app = express() 
await connectCloudinary()

app.use(cors({
  origin: "https://quick-ai-psi-two.vercel.app",
  credentials: true
}));

app.use(express.json()) 
app.use(clerkMiddleware())

app.get('/', (req, res) => res.send('Server is Live!'))

app.use('/api/ai', requireAuth(), aiRouter)
app.use('/api/user', requireAuth(), userRouter)

const PORT = process.env.PORT || 3000;

app.all('(.*)', (req, res) => {
  res.status(404).send('Route not found');
});

app.listen(PORT, () => {
    console.log('Server is running on port', PORT);
})