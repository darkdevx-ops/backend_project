import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    // TODO: toggle subscription

    const subscriberId = req.user._id

    if(!isValidObjectId(channelId)){
        throw new apiError(400, "Channel ID is invalid!")
    }

    if(subscriberId.toString() === channelId.toString()){
        throw new apiError(400, "You cannot subcribe your self.")
    }

    const existingSubscriber = await Subscription.findOne({
        subscriber : subscriberId,
        channel : channelId
    })

    if(!existingSubscriber){
        await Subscription.findOneAndDelete({
            subscriber : subscriberId,
            channel : channelId 
        })

        return res
                .status(200)
                .json(new apiResponse(200, {}, "Unsubscribed successfully."))
    }else{
        await Subscription.create({
            subscriber : subscriberId,
            channel : channelId 
        })

        return res
                .status(200)
                .json(new apiResponse(200, {}, "Subscribed successfully."))
    }


    


})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params

    if(!isValidObjectId(channelId)){
        throw new apiError(400, "Channel ID is invalid!")
    }

    const subscribersList = await Subscription.aggregate([
    {
        $match: {
            channel: new mongoose.Types.ObjectId(channelId)  // Convert to ObjectId for proper matching
        }
    },
    {
        $lookup: {
            from: 'users',  // The collection name (lowercased model name)
            localField: 'subscriber',
            foreignField: '_id',
            as: 'subscriber'
        }
    },
    {
        $unwind: '$subscriber'  // Deconstruct the subscriber array into an object
    },
    {
        $project: {
            _id: 0,  // Exclude the subscription's _id
            subscriber: {
                _id: '$subscriber._id',
                name: '$subscriber.name',
                email: '$subscriber.email'
            }
        }
    }
]);

    if(!subscribersList){
        throw new apiError(400, "No subscribers found")
    }

    return res
            .status(200)
            .json(
                new apiResponse(200, subscribersList, "Subscribers list fetched successfully!")
            )



})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const subscriberId = req.user._id

    const subscribedChannelList = await Subscription.aggregate([
    {
        $match: {
            subscriber: new mongoose.Types.ObjectId(subscriberId)  // Convert to ObjectId for proper matching
        }
    },
    {
        $lookup: {
            from: 'users',  // The collection name (lowercased model name)
            localField: 'channel',
            foreignField: '_id',
            as: 'channel'
        }
    },
    {
        $unwind: '$channel'  // Deconstruct the channel array into an object
    },
    {
        $project: {
            _id: 0,  // Exclude the channel's _id
            channel: {
                _id: '$channel._id',
                name: '$channel.name',
                email: '$channel.email'
            }
        }
    }
]);

    if(!subscribedChannelList){
        throw new apiError(400, "No Subscribed Channel found")
    }

    return res
            .status(200)
            .json(
                new apiResponse(200, subscribedChannelList, "Subscribed Channel list fetched successfully!")
            )

})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}