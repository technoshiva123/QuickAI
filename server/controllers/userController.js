import sql from "../configs/db.js"

export const getUserCreations = async(req,res)=>{
    try {
        const {userId} = req.auth()

        const creations = await sql`SELECT * FROM creations WHERE user_id=${userId} ORDER BY created_at DESC`

        res.json({success:true , creations});
    } catch (error) {
        res.json({success:false,message:error.message});
    }
}


export const getPublishedCreations = async(req,res)=>{
    try {
         const creations = await sql`
        SELECT * FROM creations WHERE publish = true ORDER BY created_at DESC`

        res.json({success:true , creations});
    } catch (error) {
        res.json({success:false,message:error.message});
    }
}

export const toggleLikeCreation = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { id } = req.body;

        // 1. Creation dhoondein
        const [creation] = await sql`SELECT * FROM creations WHERE id = ${id}`;
        
        if (!creation) {
            return res.json({ success: false, message: "Creation not found" });
        }

        // 2. Likes array handle karein (Ensure karein ki ye array hi ho)
        const currentLikes = creation.likes || []; 
        const userIdStr = String(userId);
        
        let updatedLikes;
        let message;

        if (currentLikes.includes(userIdStr)) {
            // Unlike logic
            updatedLikes = currentLikes.filter((user) => user !== userIdStr);
            message = 'Creation Unliked';
        } else {
            // Like logic
            updatedLikes = [...currentLikes, userIdStr];
            message = 'Creation Liked';
        }

        // 3. Database update 
        // Direct array pass karein, driver ise handle kar lega
        await sql`
            UPDATE creations 
            SET likes = ${updatedLikes} 
            WHERE id = ${id}
        `;

        res.json({ success: true, message });
    } catch (error) {
        console.error("Like Toggle Error:", error);
        res.json({ success: false, message: error.message });
    }
}