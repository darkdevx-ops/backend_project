import { asyncHandler  } from "../utils/asyncHandler.js";
import {apiError} from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";



const generateAccessAndRefreshToken = async(userId) =>{     //generating access and refresh token
  try {
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken                        // save refresh token in db
    await user.save({
      validateBeforeSave: false
    })

    return {accessToken, refreshToken}

  } catch (error) {
    throw new apiError(500,"Something went wrong while generating access and refresh token",error)
  }
}

const registerUser = asyncHandler( async (req , res) => {
  //step for register user
  //get user details from fronted
  //validation on input values
  //check if user already exists
  //check for images, check for avatar
  //upload them to cloudinary
  //create user object - create entry in db
  //remove password and refresh token from response
  //check for user creation
  //return response 


  //1st get user details

  const {userName, email, fullName, password} = req.body
  console.log("email :", email)


  //2nd validation
  
  // if (fullName===""){
  //   throw new apiError(400, "fullName is required")     
  // }


  if (
    [userName , email, fullName, password].some((field) =>field?.trim() === "")
  ) {
    throw new apiError(400, "All field is required")    // throw error using apiError 
  }


  //3rd check if user already exists
  
  const existedUser = await User.findOne({
    $or: [{ userName }, { email }]
  })

  if(existedUser){
    throw new apiError(409, "User already exists with same userName or email")
  }


  //4th check for images, check for avatar

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;


  if(!avatarLocalPath){
    throw new apiError(400, "Avatar file is required")
  }


  //5th upload them to cloudinary

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if(!avatar){
    throw new apiError(400, "Avatar files is required")
  }


  //6th create user object - create entry in db

  const user = await User.create({
    userName,
    fullName,
    email,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    password
  })


  //7th remove password and refresh token from response
  
  const createdUser = await User.findById(user._id).select("-password -refreshToken")

  //8th check for user creation


  if(!createdUser){
    throw new  apiError(500, "Something went wrong while registering user")
  }


  //9th return response

  return res.status(201).json(
    new apiResponse(200, createdUser, "User register successfully")
  )

})

const loginUser = asyncHandler(async(req , res) =>{
    //get username or email
    //username or email exists in db or not
    //password check
    //generate access and refresh token
    //send cookie
    //send res

    //1st get username or email

  const {userName, email, password} = req.body

  if(!(userName || email)) {
    throw new apiError(400, "username or email is required")
  }

  //2nd find username or email exists in db or not
  const user = await User.findOne({
    $or :[{userName},{email}]
  })

  if(!user) {
    throw new apiError(404,"User does not exist")
  }

  //3rd password check
  const isPasswordValid = await user.isPasswordCorrect(password)

  if(!isPasswordValid) {
    throw new apiError(401,"Invalid password")
  }

  //4th generate access and refresh token
  const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

  //5th send cookie
  const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

  const options = {
    httpOnly :true,
    secure : true
  }

  return res
  .status(200)
  .cookie("accessToken",accessToken,options)
  .cookie("refreshToken", refreshToken, options)
  .json(
    new apiResponse(
      200,
      {
        user : loggedInUser, accessToken,
        refreshToken
      },
      "User logged in successfull"
    )
  )

})

const logoutUser = asyncHandler( async(req, res) =>{
  await User.findByIdAndUpdate(req.user._id, {
    $unset : {refreshToken : 1 // tis remove from field 
      }
    },
    {
      new : true
    }
)

  const options = {
    httpOnly :true,
    secure : true
  }

  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(
    new apiResponse(200, {}, "User logout successfully")
  )
})

const refreshAccessToken = asyncHandler( async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

  if(!incomingRefreshToken){
    throw new apiError(401, "Unathorized request")
  }

  try {
    const decodedRefreshToken =jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
  
    const user = await User.findById(decodedRefreshToken?._id)
  
    if(!user){
      throw new apiError(401, "Invalid refresh token")
    }
  
    if(incomingRefreshToken !== user?.refreshToken){
      throw new apiError(401, "Refresh token is expired or used")
    }
  
    const options ={
      httpOnly : true,
      secure : true
    }
  
    const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
  
    return res
    .status(200)
    .cookie("acccessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new apiResponse(200,{accessToken, refreshToken:newRefreshToken},"Access token refreshed")
    )
  } catch (error) {
    throw new apiError(401, error?.message ||"Invalid refresh token")
  }
})

const currentUser = asyncHandler (async ( req, res) =>{
    return res
    .status(200)
    .json(new apiResponse(200, req.user, "Current user fetched successfully"))
})

// updation controller methods

const changeCurrentPassword = asyncHandler( async ( req, res) =>{
  const {oldPassword, newPassword} = req.body

  const user = await User.findById(req.user?._id)

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

  if(!isPasswordCorrect){
    throw new apiError(400, "Invalid Password")
  }

  user.password= newPassword

  await user.save({validateBeforeSave : false})

  return res
  .status(200)
  .json(new apiResponse(200, {}, "Password change successfully"))
})

const updateAccountDetails = asyncHandler( async (req, res) =>{
    const {fullName, email} = req.body

    if(!fullName || !email){
      throw new apiError(400, "Feild required")

    }

    const user = await User.findByIdAndUpdate(req.user?._id,{
      $set:{
        fullName:fullName,
        email : email
      }
    },{new:true}).select("-password")


    return res
    .status(200)
    .json(new apiResponse(200, user, "Feild updated successfully"))
})

const updateAvatarImage = asyncHandler (async (req, res)=>{
    const avatarLocalPath =req.file?.path

    if(!avatarLocalPath){
      throw new apiError(400, "Avatar file is missing")
    }

    //Todo : write a delete old avatar file method

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
      throw new apiError(400, "Error while uploading Avatar image ")
    }

    const user= await User.findByIdAndUpdate(req.user?._id,
      {
        $set:{
          avatar : avatar.url
        }
      },{
        new : true
      }).select("-password")

      return res
      .status(200)
      .json(new apiResponse(200, user, "Avatar image updated successfully"))
})

const updateCoverImage = asyncHandler (async (req, res)=>{
    const coverImageLocalPath =req.file?.path

    if(!coverImageLocalPath){
      throw new apiError(400, "Cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
      throw new apiError(400, "Error while uploading Cover image ")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
      {
        $set:{
          coverImage : coverImage.url
        }
      },{
        new : true
      }).select("-password")


      return res
      .status(200)
      .json(new apiResponse(200, user, "Cover image updated successfully"))
})


const getUserChannelProfile = asyncHandler( async( req, res)=>{
  const { userName } = req.params

  if(!userName){
    throw new apiError(400, "User not found")
  }

  const channel = await User.aggregate([{
    $match :{
      userName : userName?.toLowerCase()
    }
  },{
    $lookup:{
      from : "subscriptions",
      localField: "_id",
      foreignField: "channel",
      as: "subscribers"
    }
  },{
    $lookup:{
      from : "subscriptions",
      localField: "_id",
      foreignField: "subscriber",
      as: "channelSubscribedTo"
    }
  },{
    $addFields:{
      subscriberCount:{
        $size : "$subscribers"
      },
      channelSubscribedToCount : {
        $size : "$channelSubscribedTo"
      },
      isSubscribed :{
        $cond :{
          if:{ $in : [req.user?._id, "$subscribers.subscriber"]},
          then: true,
          else: false
        }
      }
    }
  },{
    $project : {
      fullName :1,
      userName : 1,
      subscriberCount :1,
      channelSubscribedToCount :1,
      avatar :1,
      coverImage : 1,
      isSubscribed :1,
      email : 1
    }
  }
])

  if(!channel?.length){
    throw new apiError(404,"Channel does not exist")
  }

  return res
  .status(200)
  .json(new apiResponse(200, channel[0], "User channel profile fetched successully"))
 
})

const getWatchedHistory = asyncHandler( async(req, res) =>{
  const user = await User.aggregate([
    {
      $match :{
        _id : new mongoose.Types.ObjectId(req.user._id)
      }
    },{
      $lookup :{
        from :" videos",
        localField : "watchHistory",
        foreignField : "_id",
        as : "watchHistory",
        pipeline :[{
          $lookup :{
            from : "users",
            localField: "owner",
            foreignField : "_id",
            as : "owner",
            pipeline :[{
              $project : {
                fullName :1,
                userName :1,
                avatar : 1
              }
            }]
          }
        },{
          $addFields : {
            owner : {
              $first : "$owner"
            }
          }
        }]
      }
    }
  ])

  return res
  .status(200)
  .json(new apiResponse(200, user[0].watchHistory, "Watched History fetched successfully"))
})

export {registerUser, 
        loginUser, 
        logoutUser, 
        refreshAccessToken, 
        changeCurrentPassword, 
        currentUser,
        updateAccountDetails,
        updateAvatarImage,
        updateCoverImage,
        getUserChannelProfile,
        getWatchedHistory
      }

