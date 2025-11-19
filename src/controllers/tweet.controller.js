import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    const { content } =req.body

    if(!content){
        throw new apiError(400, "Some content required for post.")
    }

    const tweetPost = await Tweet.create({
        content,
        owner : req.user._id
    })

    if(!tweetPost){
        throw new apiError(400, "Something went wrong while creating the post.")
    }


    return res
            .status(200)
            .json(new apiResponse(200, tweetPost, "Tweet post created successfully."))
})

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets

    const { userId } = req.params

    if(!isValidObjectId(userId)){
        throw new apiError(400, "User Id is invalid.")
    }

    const userTweet =  await Tweet.aggregate([{
        $match : {
            owner : new mongoose.Types.ObjectId(userId)
        }
    },
    {
        $lookup : {
            from: 'users',  // The collection name (lowercased model name)
            localField: 'owner',
            foreignField: '_id',
            as: 'owner',
            pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                            fullName: 1
                        }
                    }
                ]
        }
    },
    {
        $unwind : '$owner'
    },
    {
        $sort : {
            createdAt : -1
        }
    },
    {
        $project : {
            content: 1,
            owner :1,
            createdAt :1
        }
    }
])

    if(!userTweet){
        throw new apiError(400, "No tweet found.")
    }

    return res
            .status(200)
            .json(new apiResponse(200, {}, "Tweet fetched successfully."))

})

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet

    const { tweetId } = req.params

    const { content } = req.body

    if(!isValidObjectId(tweetId)){
        throw new apiError(400, "Tweet Id is invalid.")
    }

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
        throw new apiError(404, "Tweet not found");
    }

  /*
    - Users should only be able to edit their own tweets.
    - Convert ObjectIds to strings before comparing.
  */
    if (tweet.owner.toString() !== req.user._id.toString()) {
        throw new apiError(403, "You can only update your own tweets");
    }


    if(!content){
        throw new apiError(400, "New content is required to update.")
    }

    const updatedTweet = await Tweet.findOneAndUpdate({
        _id : tweetId,
        owner : req.user._id
    },{
        $set : {
            content
        }
    },{new : true})

    if(!updateTweet){
        throw new apiError(400, "Something went wrong while updating tweet.")
    }

    return res
            .status(200)
            .json(new apiResponse(200, {}, "Tweet updated successfully."))

})

    

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet

    const { tweetId } = req.params

    if(!isValidObjectId(tweetId)){
        throw new apiError(400, "Tweet Id is invalid.")
    }

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
        throw new apiError(404, "Tweet not found");
    }

  /*
    - Users should only be able to edit their own tweets.
    - Convert ObjectIds to strings before comparing.
  */
    if (tweet.owner.toString() !== req.user._id.toString()) {
        throw new apiError(403, "You can only delete your own tweets");
    }


    const deletedTweet = await Tweet.findOneAndDelete({
        _id : tweetId,
        owner : req.user._id
    })

    if(!deletedTweet){
        throw new apiError(400, "Something went wrong while deleting tweet.")
    }

    return res
            .status(200)
            .json(new apiResponse(200, {}, "Tweet deleted successfully."))

    
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}