import { asyncHandler  } from "../utils/asyncHandler.js";
import {apiError} from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js";



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

  if(!userName || !email) {
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
    $set : {refreshToken : undefined}
    },
    {
      new : true
    }
)

  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(
    new apiResponse(200, {}, "User logout successfully")
  )
})

export {registerUser, loginUser, logoutUser}

