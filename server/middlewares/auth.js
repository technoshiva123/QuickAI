import { clerkClient } from "@clerk/express";

export const auth = async (req, res, next) => {
    try {
        const { userId } = await req.auth();
        
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const user = await clerkClient.users.getUser(userId);

       
        const userPlan = user.privateMetadata.plan || 'free';
        const freeUsage = user.privateMetadata.free_usage || 0;

      
        const isPremium = userPlan === 'premium';

        if (!isPremium) {
            if (user.privateMetadata.free_usage === undefined) {
                await clerkClient.users.updateUserMetadata(userId, {
                    privateMetadata: {
                        free_usage: 3 
                    }
                });
                req.free_usage = 3;
            } else {
                req.free_usage = freeUsage;
            }
        } else {
            req.free_usage = 0; 
        }

        req.plan = userPlan;
        next();

    } catch (error) {
        console.error("Auth Middleware Error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}