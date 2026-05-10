import exprss from 'express'
import cors from 'cors'
import 'dotenv/config'
import { clerkMiddleware, requireAuth } from '@clerk/express'
import aiRouter from './routes/aiRoutes.js'
import connectCloudinary from './configs/cloudinary.js'
import userRouter from './routes/userRoutes.js'
const app = exprss()

await connectCloudinary()

app.use(cors({
  origin: "https://quick-ai-psi-two.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://quick-ai-psi-two.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

app.use(exprss.json())
app.use(clerkMiddleware())

app.get('/',(req,res)=>res.send('Server is Live!'))

app.use(requireAuth())
app.use('/api/ai',aiRouter)
app.use('/api/user',userRouter)


const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
    console.log('Server is running on port',PORT);
})