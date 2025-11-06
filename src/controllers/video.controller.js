import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {apiError} from "../utils/apiError.js"
import {apiResponse} from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy = 'createdAt', sortType = 'desc', userId } = req.query

    // Validate sortBy to prevent injection
    const allowedSortFields = ['createdAt', 'views', 'duration', 'title']
    if (!allowedSortFields.includes(sortBy)) {
        throw new apiError(400, 'Invalid sortBy field')
    }

    // Validate sortType
    const sortOrder = sortType === 'asc' ? 1 : -1

    // Build match conditions
    const matchConditions = { isPublished: true } // Only fetch published videos

    if (userId && isValidObjectId(userId)) {
        matchConditions.owner = userId
    }

    if (query) {
        matchConditions.$or = [
            { title: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } }
        ]
    }

    // Aggregation pipeline
    const pipeline = [
        { $match: matchConditions },
        {
            $lookup: {
                from: 'users',
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
        { $unwind: '$owner' },
        { $sort: { [sortBy]: sortOrder } },
        {
            $project: {
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                createdAt: 1,
                owner: 1
            }
        }
    ]

    // Use aggregatePaginate for pagination
    const options = {
        page: parseInt(page),
        limit: parseInt(limit)
    }

    const result = await Video.aggregatePaginate(Video.aggregate(pipeline), options)

    if(!result){
        throw new apiError(400, "Video not found!!")
    }

    return res.status(200).json(
        new apiResponse(200, result, 'Videos fetched successfully')
    )
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video
    if (
    [title , description].some((field) =>field?.trim() === "")
  ) {
    throw new apiError(400, "All field is required")    // throw error using apiError 
  }
    // check for video file and thumbnail
    const videoLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailPath = req.files?.thumbnail?.[0]?.path;

    if(!videoLocalPath){
        throw new apiError(400,"Video file is required.")
    }

    if(!thumbnailPath){
        throw new apiError(400,"Thumbnail is required.")
    }

    const videoFile = await uploadOnCloudinary(videoLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailPath)

    if(!videoFile){
        throw new apiError(400, "Video files is required")
    }

    if(!thumbnail){
        throw new apiError(400, "Thumbnail files is required")
    }

    // create an object for video in db
    const video = await Video.create({
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        title,
        description,
        
      })

      const uploadedVideo = await Video.findById(video._id).select("-videoFile -thumbnail")

  // check for video upload


  if(!uploadedVideo){
    throw new  apiError(500, "Something went wrong while uploading video")
  }


  // return response

  return res.status(201).json(
    new apiResponse(200, uploadedVideo, "Video uploaded successfully")
  )
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id

    if(!isValidObjectId(videoId)){
        throw new apiError(400, "VideoID is invalid.")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new apiError(404, "Video not found.")
    }

    return res
            .status(200)
            .json(new apiResponse(200, video, "This is your Video."))
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

    if(!isValidObjectId(videoId)){
        throw new apiError(400,"VideoID is invalid.")
    }

    const {title, description} = req.body

    const thumbnailPath =req.file?.path

    if(!title || !description || !thumbnailPath){
      throw new apiError(400, "Feild required")

    }

    

    //Todo : write a delete old avatar file method

    const thumbnail = await uploadOnCloudinary(thumbnailPath)

    if(!thumbnail.url){
      throw new apiError(400, "Error while uploading Thumbnail image ")
    }

    const updatedVideo = await Video.findByIdAndUpdate({_id: videoId, owner: req.user._id},{
      $set:{
        title:title,
        description : description,
        thumbnail: thumbnail.url
      }
    },{new:true})


    if(!updatedVideo){
        throw new apiError(400,"Video not found or You don't have the access to update this video.")
    }


    return res
    .status(200)
    .json(new apiResponse(200, updatedVideo, "Feild updated successfully"))

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
    if(!isValidObjectId(videoId)){
        throw new apiError(400,"VideoID is invalid.")
    }

    const deletedVideo = await Video.findByIdAndDelete({_id: videoId, owner: req.user._id},{new : true})

    if(!deletedVideo){
        throw new apiError(400,"Video not found or You don't have the access to delete this video.")
    }

    return res.status(200).json(new apiResponse(200, deletedVideo, "Video deleted successfully."))

})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!isValidObjectId(videoId)){
        throw new apiError(400,"VideoID is invalid.")
    }

    const video = await Video.findById(videoId)

    if(!video){
        throw new apiError(400,"Video not found.")
    }

    if(req.user._id.toString() != video.owner.toString()){
        throw new apiError(400, "You are not athorized to update this field.")
    }

    video.isPublished = !video.isPublished

    await video.save()

    return res
            .status(200)
            .json(new apiResponse(200, video, "Status changed successfully!"))

})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}