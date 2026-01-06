import OpenAI from "openai";
import sql from "../configs/db.js";
import { clerkClient } from "@clerk/express";
import { v2 as cloudinary } from 'cloudinary'
import FormData from "form-data";
import axios from "axios";
import fs from 'fs';
import { createRequire } from 'module';
import pdf from 'pdf-parse-fork';


const AI = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

export const generateArticle = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { prompt, length } = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage;

        if (plan !== 'premium' && free_usage >= 10) {
            return res.json({ success: false, message: "Limited reached  Upgrade to Continue." })
        }

        const Prompt = `Write a comprehensive article about: ${prompt}. 
        Length: Please aim for around ${length} words. 
        Format: Use Markdown with clear headings.`;

        const response = await AI.chat.completions.create({
            model: "gemini-2.5-flash",
            messages: [{ role: "user", content: Prompt }],
            temperature: 0.8,
            // 1 word approx 1.5 tokens hota hai, toh safety ke liye 2x rakhein
            max_tokens: Math.min(parseInt(length) * 2, 4000),
        });

        const content = response.choices[0].message.content

        await sql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId},${prompt},${content},'article')`

        if (plan !== 'premium') {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: {
                    free_usage: free_usage + 1
                }
            })
        }
        res.json({ success: true, content })
    } catch (error) {
        console.log(error.message)
        res.json({ success: false, message: error.message })
    }
}

export const generateBlogTitle = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { prompt } = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage;

        if (plan !== 'premium' && free_usage >= 10) {
            return res.json({ success: false, message: "Limited reached  Upgrade to Continue." })
        }

        const finalPrompt = `Topic: ${prompt}
            Task: Write 10 catchy blog titles.
        Rules: 
        - Start directly with "1." 
        - No introductory text. 
        - No "Here are the titles".
        - Keep titles concise.`;

        const response = await AI.chat.completions.create({
            model: "gemini-2.5-flash",
            messages: [{ role: "user", content: finalPrompt, }],
            temperature: 0.7,
            max_tokens: 1000,
        });

        const content = response.choices[0].message.content

        await sql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId},${prompt},${content},'blog-title')`

        if (plan !== 'premium') {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: {
                    free_usage: free_usage + 1
                }
            })
        }
        res.json({ success: true, content })
    } catch (error) {
        console.log(error.message)
        res.json({ success: false, message: error.message })
    }
}


export const generateImage = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { prompt, publish } = req.body;
        const plan = req.plan;

        // 1. Subscription Check
        if (plan !== 'premium') {
            return res.json({
                success: false,
                message: "This feature is only available for premium subscriptions.",
            });
        }

        // 2. Prepare FormData for ClipDrop
        const formData = new FormData();
        formData.append('prompt', prompt);

        // 3. ClipDrop API Call
        console.log("Generating image via ClipDrop...");
        const { data } = await axios.post(
            "https://clipdrop-api.co/text-to-image/v1",
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    "x-api-key": process.env.CLIPDROP_API_KEY,
                },
                responseType: "arraybuffer",
            }
        );

        // 4. Convert to Base64 and Upload to Cloudinary
        const base64Image = `data:image/png;base64,${Buffer.from(data, "binary").toString("base64")}`;
        
        console.log("Uploading to Cloudinary...");
        const { secure_url } = await cloudinary.uploader.upload(base64Image);

        // 5. Database Entry (Inside its own try-catch to prevent crashing)
        try {
            await sql`
                INSERT INTO creations (user_id, prompt, content, type, publish)
                VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${Boolean(publish)})
            `;
            console.log("Saved to database successfully.");
        } catch (dbError) {
            console.error("Database Connection Failed (TypeError: fetch failed):", dbError.message);
            // Hum yahan function stop nahi karenge, user ko image fir bhi dikhayenge
        }

        // 6. Final Success Response
        return res.json({ success: true, content: secure_url });

    } catch (error) {
        console.error("Image Generation Error:");
        if (error.response) {
            const errorDetail = Buffer.from(error.response.data).toString();
            console.log("ClipDrop Error:", errorDetail);
            res.json({ success: false, message: `ClipDrop Error: ${errorDetail}` });
        } else {
            console.log("General Error:", error.message);
            res.json({ success: false, message: error.message });
        }
    }
};



export const removeImageBackground = async (req, res) => {
    try {
        const { userId } = req.auth();
        const image = req.file; // Multer se file aati hai
        const plan = req.plan;

        if (plan !== 'premium') {
            return res.json({ success: false, message: "Upgrade to premium to use this." });
        }

        // ClipDrop API Call for Background Removal
        const formData = new FormData();
        formData.append('image_file', fs.createReadStream(image.path));

        const response = await axios.post('https://clipdrop-api.co/remove-background/v1', formData, {
            headers: {
                ...formData.getHeaders(),
                'x-api-key': process.env.CLIPDROP_API_KEY,
            },
            responseType: 'arraybuffer',
        });

        // Binary data ko Cloudinary par upload karein
        const buffer = Buffer.from(response.data, "binary");
        
        const uploadResponse = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }).end(buffer);
        });

        const secure_url = uploadResponse.secure_url;

        // Database entry
        await sql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, 'Background Removal', ${secure_url}, 'image')`;

        // Local temporary file delete karein (Agar multer use kar rahe hain)
        if (fs.existsSync(image.path)) fs.unlinkSync(image.path);

        res.json({ success: true, content: secure_url });

    } catch (error) {
        console.log("Error:", error.message);
        res.json({ success: false, message: error.message });
    }
};


export const removeImageObject = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { object } = req.body;
        const image = req.file;
        const plan = req.plan;

        if (plan !== 'premium') {
            return res.json({ success: false, message: "Upgrade to premium to use this." });
        }

        // Processing and Uploading in one step
        const result = await cloudinary.uploader.upload(image.path, {
            transformation: [{ effect: `gen_remove:prompt_${object}` }],
            resource_type: 'image'
        });

        const imageUrl = result.secure_url;

        // Save to Database
        await sql`
            INSERT INTO creations (user_id, prompt, content, type)
            VALUES (${userId}, ${`Removed ${object} from image`}, ${imageUrl}, 'image')
        `;

        // Temporary file cleanup
        if (fs.existsSync(image.path)) fs.unlinkSync(image.path);

        res.json({ success: true, content: imageUrl });

    } catch (error) {
        console.error("Object Removal Error:", error.message);
        res.json({ success: false, message: error.message });
    }
};




export const resumeReview = async (req, res) => {
    const resumePath = req.file?.path;

    try {
        const { userId } = req.auth();
        const resume = req.file;
        const plan = req.plan;

        // 1. Subscription check
        if (plan !== 'premium') {
            if (resumePath) fs.unlinkSync(resumePath);
            return res.json({
                success: false,
                message: "This feature is only available for premium subscriptions.",
            });
        }

        // 2. File Check
        if (!resume) {
            return res.json({ success: false, message: "No file uploaded." });
        }

        // 3. PDF Parsing (Ab crash nahi hoga)
        const dataBuffer = fs.readFileSync(resumePath);
        
        // pdf-parse-fork direct function export karta hai
        const pdfData = await pdf(dataBuffer);

        if (!pdfData || !pdfData.text) {
            throw new Error("Could not extract text from the PDF file.");
        }

        // 4. AI Analysis
        const prompt = `Review the following resume and provide feedback in Markdown format. Resume Content:\n\n${pdfData.text}`;

        const response = await AI.chat.completions.create({
            model: "gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
        });

        const content = response.choices[0].message.content;

        // 5. Database entry
        await sql`
            INSERT INTO creations (user_id, prompt, content, type)
            VALUES (${userId}, 'Review the uploaded resume', ${content}, 'resume-review')
        `;

        // 6. Cleanup & Response
        fs.unlinkSync(resumePath);
        res.json({ success: true, content });

    } catch (error) {
        console.error("Analysis Error:", error);
        if (resumePath && fs.existsSync(resumePath)) {
            fs.unlinkSync(resumePath);
        }
        res.json({ success: false, message: "Error: " + error.message });
    }
};