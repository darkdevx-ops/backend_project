import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp") //temp file storage location
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname) ///temp file name
  }
})

export const upload = multer({ 
  storage: storage,
 })