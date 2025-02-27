//IMPORT
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();
const gis = require("g-i-s");
const youtubesearchapi = require("youtube-search-api");
const { YoutubeTranscript } = require("youtube-transcript");
const {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} = require("@google/generative-ai");
const { createApi } = require("unsplash-js");
const showdown = require("showdown");
const axios = require("axios");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Razorpay = require("razorpay");
const csvParser = require("csv-parser");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { log } = require("console");

//INITIALIZE
const app = express();
app.use(
  cors({
    "Access-Control-Allow-Origin": "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204,
    "Access-Control-Allow-Headers":
      "Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers",
  })
);
const PORT = process.env.PORT;
app.use(bodyParser.json({ limit: "100mb" }));
const conn = mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then((open) => console.log("connected to DB"))
  .catch((err) => console.log("Not connected to Db"));
const db = mongoose.connection;
const gfs = new mongoose.mongo.GridFSBucket(db, {
  bucketName: "Attachments",
});

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  service: "gmail",
  secure: true,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const unsplash = createApi({ accessKey: process.env.UNSPLASH_ACCESS_KEY });

const storage = multer.diskStorage({
  destination: "excel",
  filename: (req, file, cb) => {
    cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const upload1 = multer({
  dest: "attachments",
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
    files: 5,
  },
});

const upload = multer({ storage: storage });

//SCHEMA
const adminSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  fname: String,
  lname: String,
  phone: String,
  dob: String,
  designation: String,
  password: String,
  type: { type: String, required: true },
  total: { type: Number, default: 0 },
  terms: { type: String, default: "" },
  privacy: { type: String, default: "" },
  cancel: { type: String, default: "" },
  refund: { type: String, default: "" },
  billing: { type: String, default: "" },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  verifyToken: { type: String, default: null },
  verifyTokenExpires: { type: Date, default: null },
  verified: { type: Boolean, default: true },
});

const RoleAccessLevelSchema = new mongoose.Schema(
  {
    role_name: String,
    accessLevels: [
      {
        feature: String,
        permissions: [String],
      },
    ],
    status: String,
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  fname: String,
  lname: String,
  phone: String,
  dob: String,
  password: String,
  type: String,
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  verifyToken: { type: String, default: null },
  verifyTokenExpires: { type: Date, default: null },
  verified: { type: Boolean, default: true },
});
const ImageSchema = new mongoose.Schema({
  name: String,
  user: String,
  image: String,
});

const courseSchema = new mongoose.Schema({
  user: String,
  fname: String,
  lname: String,
  phone: String,
  email: String,
  content: { type: String, required: true },
  type: String,
  mainTopic: String,
  photo: String,
  date: { type: Date, default: Date.now },
  end: { type: Date, default: Date.now },
  completed: { type: Boolean, default: false },
});
const subscriptionPlanSchema = new mongoose.Schema({
  packagename: String,
  price: Number,
  inr: Number,
  course: Number,
  tax: Number,
  subtopic: String,
  coursetype: String,
  stripeId: String,
});
const subscriptionSchema = new mongoose.Schema({
  user: String,
  recieptId: String,
  fname: String,
  lname: String,
  phone: String,
  email: String,
  amount: String,
  course: Number,
  subscription: String,
  subscriberId: String,
  plan: String,
  method: String,
  tax: Number,
  date: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
});
const contactShema = new mongoose.Schema({
  fname: String,
  lname: String,
  email: String,
  phone: Number,
  msg: String,
  date: { type: Date, default: Date.now },
});

const planCountShema = new mongoose.Schema({
  user: String,
  count: Number,
});

const TicketSchema = new mongoose.Schema(
  {
    user: String,
    fname: String,
    lname: String,
    phone: String,
    email: String,
    ticketId: String,
    category: String,
    subject: String,
    desc1: String,
    desc2: { type: String, default: null },
    priority: String,
    status: { type: String, default: null },
    team: { type: String, default: null },
  },
  { timestamps: true }
);

const categorySchema = new mongoose.Schema({
  category: String,
});

const prioritySchema = new mongoose.Schema({
  priority: String,
});
const statusSchema = new mongoose.Schema({
  status: String,
  color: String,
});

const TaxSchema = new mongoose.Schema({
  taxname: String,
  percentage: String,
});

const HelpSchema = new mongoose.Schema(
  {
    user: String,
    ticketId: String,
    createdby: String,
    attachment: String,
    attachment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GridFSBucket",
    },
  },
  { timestamps: true }
);

const policiesSchema = new mongoose.Schema({
  terms: { type: String, default: "" },
  privacy: { type: String, default: "" },
  cancel: { type: String, default: "" },
  refund: { type: String, default: "" },
  billing: { type: String, default: "" },
});

const NotificationSchema = new mongoose.Schema({
  user: String,
  subject:String,
  description:String,
  read:String,
},{timestamps:true});

const faqSchema = new mongoose.Schema({
  title:String,
  content:String,
},{timestamps:true});


const otpSchema = new mongoose.Schema({
  email:String,
  otp:Number,
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '5m' 
  }
});


//MODEL
const User = mongoose.model("User", userSchema);
const ProfileImage = mongoose.model("ProfileImage", ImageSchema);
const Roles = mongoose.model("Role", RoleAccessLevelSchema);
const Course = mongoose.model("Course", courseSchema);
const SubscriptionPlan = mongoose.model(
  "SubscriptionPlan",
  subscriptionPlanSchema
);
const Subscription = mongoose.model("Subscription", subscriptionSchema);
const Contact = mongoose.model("Contact", contactShema);
const Admin = mongoose.model("Admin", adminSchema);
const Count = mongoose.model("Count", planCountShema);
const Ticket = mongoose.model("Ticket", TicketSchema);
const Category = mongoose.model("Category", categorySchema);
const Priority = mongoose.model("Priorty", prioritySchema);
const Status = mongoose.model("Status", statusSchema);
const Tax = mongoose.model("Tax", TaxSchema);
const Help = mongoose.model("Help", HelpSchema);
const Policies = mongoose.model("Policy", policiesSchema);
const Notify = mongoose.model("Notify", NotificationSchema);
const Faq = mongoose.model("Faq", faqSchema);
const OTP = mongoose.model("otp",otpSchema);

app.post("/api/otp", async (req, res) => {
  const { email,fname,lname } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(409).json({
        success: false,
        error: "EMAIL_ALREADY_EXISTS",
        message: "User with this email already exists",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    const existingOTP = await OTP.findOne({ email });

    if (existingOTP) {
      existingOTP.otp = otp;
      existingOTP.createdAt = new Date(); 
      await existingOTP.save();
    } else {
      const newOTP = new OTP({ email, otp });
      await newOTP.save();
    }
    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: `Welcome to Pick My Course!`,
      html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
                <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
                <html lang="en">
                
                  <head></head>
                 <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Welcome to <strong>PickMyCourse !</strong>, Change Email address<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
                 </div>
                
                  <body style="margin-left:auto;margin-right:auto;margin-top:auto;margin-bottom:auto;background-color:rgb(255,255,255);font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, &quot;Noto Sans&quot;, sans-serif, &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;, &quot;Segoe UI Symbol&quot;, &quot;Noto Color Emoji&quot;">
                    <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:37.5em;margin-left:auto;margin-right:auto;margin-top:40px;margin-bottom:40px;width:465px;border-radius:0.25rem;border-width:1px;border-style:solid;border-color:rgb(234,234,234);padding:20px">
                      <tr style="width:100%">
                        <td>
                          <h1 style="margin-left:0px;margin-right:0px;margin-top:30px;margin-bottom:30px;padding:0px;text-align:center;font-size:24px;font-weight:400;color:rgb(0,0,0)">Welcome to <strong>PickMyCourse</strong></h1>
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Hi <strong>${fname} ${lname}</strong>,</p>
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Welcome to <strong>PickMyCourse !</strong>, </p>
                          <p style="margin-left:0px;margin-right:0px;margin-top:5px;margin-bottom:5px;padding:0px;font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">We have received a request to update your email address associated with your account. To proceed with this request, please use the One-Time Password (OTP) provided below:</p>
                           <p style="margin-left:0px;margin-right:0px;margin-top:5px;margin-bottom:5px;padding:0px;font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Your OTP:<strong> ${otp} </strong></p>
                            <p style="margin-left:0px;margin-right:0px;margin-top:5px;margin-bottom:5px;padding:0px;font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">This OTP is valid for a limited time and will expire in 5 minutes. Please enter this code in the designated field to complete your email update.</p>                          
                          
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Thank you for your attention,<p target="_blank" style="color:rgb(0,0,0);text-decoration:none;text-decoration-line:none">The <strong>Pick My Course</strong> Team</p></p>
                          </td>
                      </tr>
                    </table>
                  </body>
                
                </html>`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "newOTP created successfully",
    });
  } catch (error) {
    console.error(error); 
    res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An error occurred while processing your request.",
    });
  }
});

app.post("/api/validate-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {

    const record = await OTP.findOne({ email });
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: "OTP_NOT_FOUND",
        message: "No OTP record found for this email or OTP has expired.",
      });
    }

    if (record.otp !== otp) {
      return res.status(400).json({
        success: false,
        error: "INVALID_OTP",
        message: "The provided OTP is invalid.",
      });
    }

    await OTP.deleteOne({ email });

    res.status(200).json({
      success: true,
      message: "OTP validated successfully.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error.",
    });
  }
});


app.post("/order", async (req, res) => {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = req.body;
    const order = await razorpay.orders.create(options);

    if (!order) {
      return res.status(500).send("Error");
    }

    res.json(order);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error");
  }
});

app.post("/order/validate", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  const sha = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
  sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
  const digest = sha.digest("hex");

  if (digest !== razorpay_signature) {
    return res.status(400).json({ msg: "Transaction is not legit!" });
  }

  try {
    const uid = req.body.uid;
    const plan = req.body.plan;

    await User.findOneAndUpdate({ _id: uid }, { $set: { type: plan } });

    res.json({
      msg: "success",
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });
  } catch (error) {
    console.error("User update error:", error);
    res.status(500).json({ msg: "Internal server error" });
  }
});

app.post("/razorpaycancel", async (req, res) => {
  const { user } = req.body;

  try {
    const result = await User.findOneAndUpdate(
      { _id: user },
      { $set: { type: "free" } },
      { new: true }
    );

    if (result) {
      res.json({ success: true, message: "type updated successfully" });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/usersubscription", async (req, res) => {
  const {
    user,
    fname,
    lname,
    email,
    phone,
    amount,
    course,
    subscription,
    subscriberId,
    plan,
    method,
    tax,
  } = req.body;
  try {
    const token = crypto.randomBytes(2).toString("hex");
    const recieptId = `Reciept${token}`;
    const newSub = new Subscription({
      recieptId,
      user,
      fname,
      lname,
      email,
      phone,
      amount,
      course,
      subscription,
      subscriberId,
      plan,
      method,
      tax,
    });
    await newSub.save();

    await User.findOneAndUpdate({ _id: user }, { $set: { type: plan } });
    res.status(200).json({
      success: true,
      message: "NewSubscription created successfully",
      newSub: newSub,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.get("/api/getallsubs", async (req, res) => {
  try {
    const sub = await Subscription.find();
    res.status(200).json({ success: true, sub: sub });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/getsubsbyid", async (req, res) => {
  const { user } = req.query;
  try {
    const sub = await Subscription.find({ user });
    res.status(200).json({ success: true, sub: sub });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/getsubonid/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const sub = await Subscription.findByIdAndUpdate(id);
    res.status(200).json({ success: true, sub: sub });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/post", upload1.array("files", 5), async (req, res) => {
  try {
    const files = req.files;
    const user = req.body.user;
    const ticketId = req.body.ticketId;
    const createdby = req.body.createdby;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    if (files.length > 5) {
      return res
        .status(400)
        .json({ message: "File count exceeds the limit of 5" });
    }

    const attachments = [];

    for (const file of files) {
      const randomName = crypto.randomBytes(10).toString("hex");
      const writeStream = gfs.openUploadStream(randomName, {
        _id: new mongoose.Types.ObjectId(),
      });

      fs.createReadStream(file.path).pipe(writeStream);

      const attachment = new Help({
        user,
        ticketId,
        createdby,
        attachment_id: writeStream.id,
        attachment: randomName,
      });

      await attachment.save();
      attachments.push(attachment);
    }
    for (const file of files) {
      fs.unlinkSync(file.path);
    }

    res.status(200).json(attachments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to upload files" });
  }
});

app.get("/api/getattachments", async (req, res) => {
  const { ticketId } = req.query;
  try {
    const attachments = await Help.find({ ticketId });
    if (attachments.length > 0) {
      return res.json({ success: true, attachments: attachments });
    } else {
      return res.json({
        success: false,
        message: "No attachments found for this ticketId ",
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/file/:filename", async (req, res) => {
  const { filename } = req.params;
  try {
    const file = await gfs.find({ filename }).toArray();

    if (!file || file.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    const readStream = gfs.openDownloadStream(file[0]._id);
    res.set("Content-Type", file[0].contentType);
    readStream.pipe(res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/policies", async (req, res) => {
  const { terms, privacy, cancel, refund, billing } = req.body;

  try {
    const updatedPolicy = await Policies.findOneAndUpdate(
      {},
      {
        $set: {
          terms,
          privacy,
          cancel,
          refund,
          billing,
        },
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: "Policy updated or created successfully",
      data: updatedPolicy,
    });
  } catch (error) {
    console.error("Error in /api/policies:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/policies", async (req, res) => {
  try {
    const policy = await Policies.findOne({});
    if (policy) {
      res.json({ success: true, data: policy });
    } else {
      res.json({ success: false, message: "No policies found" });
    }
  } catch (error) {
    console.error("Error in /api/policies:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.delete("/api/policies", async (req, res) => {
  try {
    await Policies.deleteOne({});
    res.json({ success: true, message: "Policy deleted successfully" });
  } catch (error) {
    console.error("Error in /api/policies:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//faq

app.post("/api/faq", async (req, res) => {
  const { title,content } = req.body;
  try {
    const newFaq = new Faq({ title,content });
    await newFaq.save();
    res
      .status(200)
      .json({
        success: true,
        message: "New FAQ created successfully",
        Faq: newFaq,
      });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
app.delete("/api/deletefaq/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deletedFaq = await Faq.findByIdAndDelete(id);

    if (!deletedFaq) {
      return res
        .status(404)
        .json({ success: false, message: "Faq not found" });
    }

    res
      .status(200)
      .json({
        success: true,
        message: "Faq deleted successfully",
        Faq: deletedFaq,
      });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
  }
});

app.get("/api/getfaq", async (req, res) => {
  try {
    const faq = await Faq.find();
    res.status(200).json({ success: true, faq:faq });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//REQUEST
app.post("/api/countplan", async (req, res) => {
  const { user, count } = req.body;

  try {
    // Check if a document with the same user already exists
    const existingUser = await Count.findOne({ user });

    if (existingUser) {
      // If the user already exists, update the count
      existingUser.count = count;
      await existingUser.save();
      return res.json({
        success: true,
        message: "Count updated  for existing user",
      });
    }

    // If no document is found, create a new one
    const course_count = new Count({ user, count });
    await course_count.save();

    res.json({ success: true, message: "Count created successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/updatecount", async (req, res) => {
  const { user } = req.body;

  try {
    const replace = await Count.findOne({ user });
    if (!replace) {
      return res
        .status(404)
        .json({ success: false, message: "User  not found" });
    }
    const result = await Count.findOneAndUpdate(
      { user: user },
      { $set: { count: replace.count - 1 } },
      { new: true }
    );

    res.json({
      success: true,
      message: "Count updated successfully",
      count: result.count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/getcountplan", async (req, res) => {
  try {
    const { user } = req.query;
    await Count.find({ user: user }).then((result) => {
      res.json(result);
    });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

//Admins

app.post("/api/adminsignup", async (req, res) => {
  const {
    email,
    fname,
    lname,
    phone,
    dob,
    designation,
    password,
    type,
    logo,
    company,
  } = req.body;

  try {
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(401).json({
        success: false,
        message: "User with this email already exists",
      });
    }
    const token = crypto.randomBytes(20).toString("hex");
    const newAdmin = new Admin({
      email,
      fname,
      lname,
      phone,
      dob,
      designation,
      password,
      type,
      verifyToken: token,
      verifyTokenExpires: Date.now() + 3600000,
    });
    await newAdmin.save();
    const verifyLink = `${process.env.WEBSITE_URL}/verify/${token}`;

    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: `${fname} Verify Email`,
      html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
                <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
                <html lang="en">
                
                  <head></head>
                 <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Welcome to AiCourse<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
                 </div>
                
                  <body style="margin-left:auto;margin-right:auto;margin-top:auto;margin-bottom:auto;background-color:rgb(255,255,255);font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, &quot;Noto Sans&quot;, sans-serif, &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;, &quot;Segoe UI Symbol&quot;, &quot;Noto Color Emoji&quot;">
                    <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:37.5em;margin-left:auto;margin-right:auto;margin-top:40px;margin-bottom:40px;width:465px;border-radius:0.25rem;border-width:1px;border-style:solid;border-color:rgb(234,234,234);padding:20px">
                      <tr style="width:100%">
                        <td>
                          <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-top:32px">
                            <tbody>
                              <tr>
                                <td><img alt="logo" src="" width="40" height="37" style="display:block;outline:none;border:none;text-decoration:none;margin-left:auto;margin-right:auto;margin-top:0px;margin-bottom:0px" /></td>
                              </tr>
                            </tbody>
                          </table>
                          <h1 style="margin-left:0px;margin-right:0px;margin-top:30px;margin-bottom:30px;padding:0px;text-align:center;font-size:24px;font-weight:400;color:rgb(0,0,0)">Welcome to <strong>PickMyCourse</strong></h1>
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Hello <strong>${fname}</strong>,</p>
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Welcome to <strong>PickMyCourse</strong>, Unleash your AI potential with our platform, offering a seamless blend of theory and video courses. Dive into comprehensive lessons, from foundational theories to real-world applications, tailored to your learning preferences. Experience the future of AI education with AiCourse – where theory meets engaging visuals for a transformative learning journey!.</p>
                          <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-bottom:32px;margin-top:32px;text-align:center">
                            <tbody>
                              <tr>
                                <td><a href="${verifyLink}" target="_blank" style="p-x:20px;p-y:12px;line-height:100%;text-decoration:none;display:inline-block;max-width:100%;padding:12px 20px;border-radius:0.25rem;background-color:rgb(0,0,0);text-align:center;font-size:12px;font-weight:600;color:rgb(255,255,255);text-decoration-line:none"><span></span><span style="p-x:20px;p-y:12px;max-width:100%;display:inline-block;line-height:120%;text-decoration:none;text-transform:none;mso-padding-alt:0px;mso-text-raise:9px"><span>Verify Email</span></a></td>
                              </tr>
                            </tbody>
                          </table>
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Best,<p target="_blank" style="color:rgb(0,0,0);text-decoration:none;text-decoration-line:none">The <strong>${company}</strong> Team</p></p>
                          </td>
                      </tr>
                    </table>
                  </body>
                
                </html>`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "An Email sent to your account please verify",
      userId: newAdmin._id,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/verify", async (req, res) => {
  const { token } = req.body;
  try {
    const admin = await Admin.findOne({
      verifyToken: token,
      verifyTokenExpires: { $gt: Date.now() },
    });
    if (!admin) {
      return res
        .status(401)
        .json({ success: true, message: "Invalid or expired token" });
    }

    admin.verifyToken = null;
    admin.verifyTokenExpires = null;
    admin.verified = true;

    await admin.save();

    res.status(200).send({ message: "Email verified successfully" });
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/api/adminsignin", async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    if (!admin.verified) {
      if (admin.verifyToken && admin.verifyTokenExpires > Date.now()) {
        return res.json({ message: "Please verify your email first" });
      } else {
        const token = crypto.randomBytes(20).toString("hex");
        admin.verifyToken = token;
        admin.verifyTokenExpires = Date.now() + 3600000;
        await admin.save();

        const verifyLink = `${process.env.WEBSITE_URL}/verify/${token}`;

        const mailOptions = {
          from: process.env.EMAIL,
          to: admin.email,
          subject: `${admin.fname} Verify Email`,
          html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
            <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
            <html lang="en">
            
              <head></head>
             <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Welcome to AiCourse<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
             </div>
            
              <body style="margin-left:auto;margin-right:auto;margin-top:auto;margin-bottom:auto;background-color:rgb(255,255,255);font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, &quot;Noto Sans&quot;, sans-serif, &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;, &quot;Segoe UI Symbol&quot;, &quot;Noto Color Emoji&quot;">
                <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:37.5em;margin-left:auto;margin-right:auto;margin-top:40px;margin-bottom:40px;width:465px;border-radius:0.25rem;border-width:1px;border-style:solid;border-color:rgb(234,234,234);padding:20px">
                  <tr style="width:100%">
                    <td>
                      <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-top:32px">
                        <tbody>
                          <tr>
                            <td><img alt="Vercel" src="" width="40" height="37" style="display:block;outline:none;border:none;text-decoration:none;margin-left:auto;margin-right:auto;margin-top:0px;margin-bottom:0px" /></td>
                          </tr>
                        </tbody>
                      </table>
                      <h1 style="margin-left:0px;margin-right:0px;margin-top:30px;margin-bottom:30px;padding:0px;text-align:center;font-size:24px;font-weight:400;color:rgb(0,0,0)">Welcome to <strong>PickMyCourse</strong></h1>
                      <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Hello <strong>${admin.fname}</strong>,</p>
                      <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Welcome to <strong>PickMyCourse</strong>, Unleash your AI potential with our platform, offering a seamless blend of theory and video courses. Dive into comprehensive lessons, from foundational theories to real-world applications, tailored to your learning preferences. Experience the future of AI education with AiCourse – where theory meets engaging visuals for a transformative learning journey!.</p>
                      <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-bottom:32px;margin-top:32px;text-align:center">
                        <tbody>
                          <tr>
                            <td><a href="${verifyLink}" target="_blank" style="p-x:20px;p-y:12px;line-height:100%;text-decoration:none;display:inline-block;max-width:100%;padding:12px 20px;border-radius:0.25rem;background-color:rgb(0,0,0);text-align:center;font-size:12px;font-weight:600;color:rgb(255,255,255);text-decoration-line:none"><span></span><span style="p-x:20px;p-y:12px;max-width:100%;display:inline-block;line-height:120%;text-decoration:none;text-transform:none;mso-padding-alt:0px;mso-text-raise:9px"><span>Verify Email</span></a></td>
                          </tr>
                        </tbody>
                      </table>
                      <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Best,<p target="_blank" style="color:rgb(0,0,0);text-decoration:none;text-decoration-line:none">The <strong>SeenIT</strong> Team</p></p>
                      </td>
                  </tr>
                </table>
              </body>
            
            </html>`,
        };

        await transporter.sendMail(mailOptions);

        return res.json({
          message: "An Email sent to your account please verify",
        });
      }
    }

    if (password === admin.password) {
      return res.status(200).json({
        success: true,
        message: "SignIn successful",
        adminData: admin,
      });
    }

    res
      .status(401)
      .json({ success: false, message: "Invalid email or password" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/forgot", async (req, res) => {
  const { email, company } = req.body;

  try {
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    const token = crypto.randomBytes(20).toString("hex");
    admin.resetPasswordToken = token;
    admin.resetPasswordExpires = Date.now() + 3600000;
    await admin.save();

    const resetLink = `${process.env.WEBSITE_URL}/reset-password/${token}`;

    const mailOptions = {
      from: process.env.EMAIL,
      to: admin.email,
      subject: `Your Password Reset`,
      html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
            <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
            <html lang="en">
            
              <head></head>
             <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Password Reset<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
             </div>
            
              <body style="margin-left:auto;margin-right:auto;margin-top:auto;margin-bottom:auto;background-color:rgb(255,255,255);font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, &quot;Noto Sans&quot;, sans-serif, &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;, &quot;Segoe UI Symbol&quot;, &quot;Noto Color Emoji&quot;">
                <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:37.5em;margin-left:auto;margin-right:auto;margin-top:40px;margin-bottom:40px;width:465px;border-radius:0.25rem;border-width:1px;border-style:solid;border-color:rgb(234,234,234);padding:20px">
                  <tr style="width:100%">
                    <td>
                      <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-top:32px">
                        <tbody>
                          <tr>
                            <td><img alt="Vercel" src="" width="40" height="37" style="display:block;outline:none;border:none;text-decoration:none;margin-left:auto;margin-right:auto;margin-top:0px;margin-bottom:0px" /></td>
                          </tr>
                        </tbody>
                      </table>
                      <h1 style="margin-left:0px;margin-right:0px;margin-top:30px;margin-bottom:30px;padding:0px;text-align:center;font-size:24px;font-weight:400;color:rgb(0,0,0)">Password Reset</h1>
                      <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Click on the button below to reset the password for your account ${email}.</p>
                      <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-bottom:32px;margin-top:32px;text-align:center">
                        <tbody>
                          <tr>
                            <td><a href="${resetLink}" target="_blank" style="p-x:20px;p-y:12px;line-height:100%;text-decoration:none;display:inline-block;max-width:100%;padding:12px 20px;border-radius:0.25rem;background-color:rgb(0,0,0);text-align:center;font-size:12px;font-weight:600;color:rgb(255,255,255);text-decoration-line:none"><span></span><span style="p-x:20px;p-y:12px;max-width:100%;display:inline-block;line-height:120%;text-decoration:none;text-transform:none;mso-padding-alt:0px;mso-text-raise:9px"</span><span>Reset</span></a></td>
                          </tr>
                        </tbody>
                      </table>
                      <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Best,<p target="_blank" style="color:rgb(0,0,0);text-decoration:none;text-decoration-line:none">The <strong>${company}</strong> Team</p></p>
                      </td>
                  </tr>
                </table>
              </body>
            
            </html>`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "Password reset link sent to your email",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/reset-password", async (req, res) => {
  const { password, token } = req.body;

  try {
    const user = await Admin.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: true, message: "Invalid or expired token" });
    }

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/getadmin", async (req, res) => {
  try {
    const user = await Admin.find({});
    res.status(200).json({ success: true, user: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/getadminbyid/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await Admin.findByIdAndUpdate(id);
    res.status(200).json({ success: true, user: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.delete("/api/deleteadmin/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deletedUser = await Admin.findByIdAndDelete(id);

    if (!deletedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: "User deleted successfully",
      User: deletedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.put("/api/adminupdate/:id", async (req, res) => {
  const { id } = req.params;
  const { fname, lname, email, phone, dob, designation } = req.body;

  try {
    const updatedAdmin = await Admin.findByIdAndUpdate(
      id,
      { fname, lname, email, phone, dob, designation },
      { new: true, runValidators: true }
    );

    if (!updatedAdmin) {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    res.status(200).json({
      success: true,
      message: "Admin updated successfully",
      admin: updatedAdmin,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.post("/api/adminuploadcsv", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const csvs = [];
  const filePath = path.join(__dirname, "./excel", req.file.filename);

  fs.createReadStream(filePath)
    .pipe(csvParser())
    .on("data", (row) => {
      csvs.push(row);
    })
    .on("end", async () => {
      try {
        const result = await Admin.insertMany(csvs);
        res.status(200).json({
          success: true,
          message: "Data uploaded successfully",
          data: result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Internal server error",
          error: error.message,
        });
      } finally {
        fs.unlinkSync(filePath);
      }
    })
    .on("error", (error) => {
      res.status(500).json({
        success: false,
        message: "Error reading CSV file",
        error: error.message,
      });
    });
});

app.post("/api/changepassword", async (req, res) => {
  const { email } = req.query;
  const { confirmpassword } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "admin  not found" });
    }

    admin.password = confirmpassword;
    await admin.save();

    res
      .status(200)
      .json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

//profileImage:

app.post("/api/images", async (req, res) => {
  const { name, user, image } = req.body;

  try {
    const existingImage = await ProfileImage.findOne({ user });
    if (existingImage) {
      const updatedImage = await ProfileImage.findOneAndUpdate(
        { user },
        { name, image },
        { new: true }
      );
      return res.status(200).json({
        success: true,
        message: "Image updated successfully",
        image: updatedImage,
      });
    }
    const newImage = new ProfileImage({ name, user, image });
    await newImage.save();
    res.status(201).json({
      success: true,
      message: "Profile image created successfully",
      image: newImage,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.get("/api/getimagebyid", async (req, res) => {
  const { user } = req.query;
  try {
    const image = await ProfileImage.findOne({ user });
    res.status(200).json({ success: true, user: image });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//RoleAcessLevel
app.post("/api/roleaccesslevel", async (req, res) => {
  const { role_name, accessLevels, status } = req.body;

  try {
    // Validate accessLevels
    for (const accessLevel of accessLevels) {
      if (!accessLevel.permissions || accessLevel.permissions.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Permissions array is empty for feature ${accessLevel.feature}`,
        });
      }
    }

    // Create new RoleAccessLevel document
    const roleAccessLevel = new Roles({
      role_name,
      accessLevels,
      status,
    });

    const result = await roleAccessLevel.save();
    res.status(200).json({
      success: true,
      message: "Role access level created successfully",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.put("/api/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { role_name, accessLevels, status } = req.body;

    if (!id || !role_name || !accessLevels || !status) {
      return res.status(400).json({
        status: false,
        message: "Invalid input. Please provide all required fields.",
      });
    }

    const updatedRole = await Roles.findByIdAndUpdate(
      id,
      { role_name, accessLevels, status },
      { new: true }
    );

    if (!updatedRole) {
      return res.status(404).json({
        status: false,
        message: "Role not found. Update failed.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Role updated successfully",
      data: updatedRole,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.delete("/api/roles/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deletedRole = await Roles.findByIdAndDelete(id);

    if (!deletedRole) {
      return res
        .status(404)
        .json({ success: false, message: "Role not found" });
    }

    res.status(200).json({
      success: true,
      message: "Roles deleted successfully",
      role: deletedRole,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.get("/api/getroles", async (req, res) => {
  try {
    const role = await Roles.find();
    res.status(200).json({ success: true, role: role });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/getrolebyid", async (req, res) => {
  const { rolename } = req.query;
  try {
    const role = await Roles.findOne({ rolename });
    res.status(200).json({ success: true, role: role });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//Users
app.post("/api/usersignup", async (req, res) => {
  const { email, fname, lname, phone, dob, type } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(404).json({
        success: false,
        message: "User with this email already exists",
      });
    }
    const token = crypto.randomBytes(20).toString("hex");
    const newUser = new User({
      email,
      fname,
      lname,
      phone,
      dob,
      type,
      verifyToken: token,
      verifyTokenExpires: Date.now() + 3600000,
    });
    await newUser.save();

    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: `Welcome to Pick My Course!`,
      html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
                <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
                <html lang="en">
                
                  <head></head>
                 <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Welcome to <strong>PickMyCourse !</strong>, We're excited to have you join our community of learners.<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
                 </div>
                
                  <body style="margin-left:auto;margin-right:auto;margin-top:auto;margin-bottom:auto;background-color:rgb(255,255,255);font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, &quot;Noto Sans&quot;, sans-serif, &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;, &quot;Segoe UI Symbol&quot;, &quot;Noto Color Emoji&quot;">
                    <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:37.5em;margin-left:auto;margin-right:auto;margin-top:40px;margin-bottom:40px;width:465px;border-radius:0.25rem;border-width:1px;border-style:solid;border-color:rgb(234,234,234);padding:20px">
                      <tr style="width:100%">
                        <td>
                          <h1 style="margin-left:0px;margin-right:0px;margin-top:30px;margin-bottom:30px;padding:0px;text-align:center;font-size:24px;font-weight:400;color:rgb(0,0,0)">Welcome to <strong>PickMyCourse</strong></h1>
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Hi <strong>${fname}</strong>,</p>
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Welcome to <strong>PickMyCourse !</strong>, We're excited to have you join our community of learners.</p>
                          <p style="margin-left:0px;margin-right:0px;margin-top:5px;margin-bottom:5px;padding:0px;font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Get started by creating your first AI-powered course:</p>
                           <p style="margin-left:0px;margin-right:0px;margin-top:5px;margin-bottom:5px;padding:0px;font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Here are some helpful resources to guide you:</p>
                            <p style="margin-left:0px;margin-right:0px;margin-top:5px;margin-bottom:5px;padding:0px;font-size:14px;line-height:24px;margin:16px 0;color:rgb(78, 166, 226)"><a href="https://helpcenter.pickmycourseai.support/" target="_blank" >https://helpcenter.pickmycourseai.support/</a></p>
                          
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Happy learning!,<p target="_blank" style="color:rgb(0,0,0);text-decoration:none;text-decoration-line:none">The <strong>Pick My Course</strong> Team</p></p>
                          </td>
                      </tr>
                    </table>
                  </body>
                
                </html>`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "An Email sent to your account please verify",
      userId: newUser,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/usersignin", async (req, res) => {
  const { phone } = req.body;

  try {
    const user = await User.findOne({ phone });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid  phone" });
    }

    return res
      .status(200)
      .json({ success: true, message: "SignIn successful", userId: user });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Invalid email or password" });
  }
});

app.post("/api/verify", async (req, res) => {
  const { token } = req.body;
  try {
    const user = await User.findOne({
      verifyToken: token,
      verifyTokenExpires: { $gt: Date.now() },
    });
    if (!user) {
      return res
        .status(401)
        .json({ success: true, message: "Invalid or expired token" });
    }

    user.verifyToken = null;
    user.verifyTokenExpires = null;
    user.verified = true;

    await user.save();

    res.status(200).send({ message: "Email verified successfully" });
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.get("/api/getusers", async (req, res) => {
  try {
    const user = await User.find();
    res.status(200).json({ success: true, user: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/getusersbyid", async (req, res) => {
  try {
    const { id } = req.query;
    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, user: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.delete("/api/deleteuser", async (req, res) => {
  const { id } = req.query;

  try {
    await Promise.all([
      Course.deleteMany({ user: id }),
      Help.deleteMany({ user: id }),
      Ticket.deleteMany({ user: id }),
      Subscription.deleteMany({ user: id }),
      Notify.deleteMany({ user: id }),
      ProfileImage.deleteOne({ user: id }),
      Count.deleteOne({ user: id }),
    ]);

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "User and associated data deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.post("/api/emailupdate", async (req, res) => {
  const { phone } = req.query;
  const { email } = req.body;

  try {
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    const verify = await User.findOne({ email });
    if (verify) {
      return res.status(409).json({
        success: false,
        error: "EMAIL_ALREADY_EXISTS",
        message: "User with this email already exists",
      });
    }

    user.email = email;
    await user.save();

    const updatedTickets = await Ticket.updateMany(
      { phone },
      { $set: { email } }
    );

    if (updatedTickets.modifiedCount === 0) {
      return res.status(200).json({
        success: false,
        error: "NO_TICKETS_FOUND",
        message: "No tickets found to update",
      });
    }

    const updatedCourses = await Course.updateMany(
      { phone },
      { $set: { email } }
    );

    if (updatedCourses.modifiedCount === 0) {
      return res.status(200).json({
        success: false,
        error: "NO_COURSES_FOUND",
        message: "No courses found to update",
      });
    }

    res.status(200).json({
      success: true,
      message: "Email updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
      details: error.message,
    });
  }
});


app.post("/api/phoneupdate", async (req, res) => {
  const { email } = req.query;
  const { phone } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    const verify = await User.findOne({ phone });
    if (verify) {
      return res.status(409).json({
        success: false,
        error: "PHONE_ALREADY_EXISTS",
        message: "User with this phone already exists",
      });
    }

    user.phone = phone;
    await user.save();

    const updatedTickets = await Ticket.updateMany(
      { email },
      { $set: { phone } }
    );

    if (updatedTickets.modifiedCount === 0) {
      return res.status(200).json({
        success: false,
        error: "NO_TICKETS_FOUND",
        message: "No tickets found to update",
      });
    }

    const updatedCourses = await Course.updateMany(
      { email },
      { $set: { phone } }
    );

    if (updatedCourses.modifiedCount === 0) {
      return res.status(200).json({
        success: false,
        error: "NO_COURSES_FOUND",
        message: "No courses found to update",
      });
    }

    res.status(200).json({
      success: true,
      message: "Phone updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
      details: error.message,
    });
  }
});


app.post("/api/useruploadcsv", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const csvs = [];
  const filePath = path.join(__dirname, "./excel", req.file.filename);

  fs.createReadStream(filePath)
    .pipe(csvParser())
    .on("data", (row) => {
      csvs.push(row);
    })
    .on("end", async () => {
      try {
        const result = await User.insertMany(csvs);
        res.status(200).json({
          success: true,
          message: "Data uploaded successfully",
          data: result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Internal server error",
          error: error.message,
        });
      } finally {
        fs.unlinkSync(filePath);
      }
    })
    .on("error", (error) => {
      res.status(500).json({
        success: false,
        message: "Error reading CSV file",
        error: error.message,
      });
    });
});

//SEND MAILz
app.post("/api/data", async (req, res) => {
  const receivedData = req.body;

  try {
    const emailHtml = receivedData.html;

    const options = {
      from: process.env.EMAIL,
      to: receivedData.to,
      subject: receivedData.subject,
      html: emailHtml,
    };

    const data = await transporter.sendMail(options);
    res.status(200).json(data);
  } catch (error) {
    res.status(400).json(error);
  }
});

//SUBSCRIPTION PLAN
app.post("/api/subscriptionplan", async (req, res) => {
  const {
    packagename,
    price,
    inr,
    course,
    tax,
    subtopic,
    coursetype,
    stripeId,
  } = req.body;
  try {
    const newPlan = new SubscriptionPlan({
      packagename,
      price,
      inr,
      course,
      tax,
      subtopic,
      coursetype,
      stripeId,
    });
    await newPlan.save();
    res.status(200).json({
      success: true,
      message: "Plan created successfully",
      Plan: newPlan,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/addusertoplan", async (req, res) => {
  const { packagename, email, course } = req.body;
  try {
    await User.findOneAndUpdate(
      { email: email },
      { $set: { type: packagename } }
    );

    const wantuser = await User.findOne({ email });
    if (!wantuser) {
      return res.status().json({ success: false, message: "User not found" });
    }

    const existingUser = await Count.findOne({ user: wantuser._id });

    if (existingUser) {
      existingUser.count = course;
      await existingUser.save();
      return res.json({
        success: true,
        message: "Count updated for existing user",
      });
    }
    const course_count = new Count({ user: wantuser._id, count: course });
    await course_count.save();
    return res.json({
      success: true,
      message: "New user added with course count",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "An error occurred",
      error: error.message,
    });
  }
});

app.put("/api/subscriptionplan/:id", async (req, res) => {
  const { id } = req.params;
  const {
    packagename,
    price,
    inr,
    course,
    tax,
    subtopic,
    coursetype,
    stripeId,
  } = req.body;

  try {
    const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(
      id,
      { packagename, price, inr, course, tax, subtopic, coursetype, stripeId },
      { new: true, runValidators: true } // Returns the updated document and runs validators
    );

    if (!updatedPlan) {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }

    res.status(200).json({
      success: true,
      message: "Plan updated successfully",
      Plan: updatedPlan,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.delete("/api/subscriptionplan/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deletedPlan = await SubscriptionPlan.findByIdAndDelete(id);

    if (!deletedPlan) {
      return res
        .status(404)
        .json({ success: false, message: "Plan not found" });
    }

    res.status(200).json({
      success: true,
      message: "Plan deleted successfully",
      Plan: deletedPlan,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.get("/api/getsubscriptionplan", async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find();
    res.status(200).json({ success: true, plans: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/getsubscriptionplanbyid/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await SubscriptionPlan.findById(id);
    res.status(200).json({ success: true, plan: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//TICEKT
app.post("/api/ticket", async (req, res) => {
  const {
    user,
    fname,
    lname,
    email,
    phone,
    category,
    subject,
    desc1,
    priority,
  } = req.body;
  try {
    const token = crypto.randomBytes(2).toString("hex");
    const ticketId = `Ticket${token}`;
    const newTicket = new Ticket({
      user,
      fname,
      lname,
      email,
      phone,
      ticketId,
      category,
      subject,
      desc1,
      priority,
      status: "New Ticket",
    });
    await newTicket.save();
    
    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: `Your Pick My Course Support Ticket Has Been Received ${ticketId} `,
      html: `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  </head>
  <body style="margin-left:auto;margin-right:auto;margin-top:auto;margin-bottom:auto;background-color:rgb(255,255,255);font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';">
    <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:37.5em;margin-left:auto;margin-right:auto;margin-top:40px;margin-bottom:40px;width:465px;border-radius:0.25rem;border-width:1px;border-style:solid;border-color:rgb(234,234,234);padding:20px">
      <tr style="width:100%">
        <td>
          <h1 style="margin-left:0px;margin-right:0px;margin-top:30px;margin-bottom:30px;padding:0px;text-align:center;font-size:24px;font-weight:400;color:rgb(0,0,0)">Your Pick My Course Support Ticket  ${ticketId} ! </h1>
          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Hi <strong>${fname} ${lname}</strong>,</p>
          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">This email confirms that we've received your support <strong> ${ticketId} </strong></p>
          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Thank you for contacting <strong>Pick My Course</strong>  Support! We appreciate you reaching out to us.</p>
          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">We understand you're experiencing an issue with <strong> ${subject} </strong>. Our team is currently reviewing your request and will be in touch within 1 business day to assist you further</p>
          <p style="font-size:14px;line-height:10px;margin:16px 0;color:rgb(0,0,0)">You may also find helpful information in our Help Center:</p>
          <p style="margin-left:0px;margin-right:0px;margin-top:5px;margin-bottom:5px;padding:0px;font-size:14px;line-height:10px;margin:16px 0;color:rgb(78, 166, 226)"><a href="https://helpcenter.pickmycourseai.support/" target="_blank" >https://helpcenter.pickmycourseai.support/</a></p>
          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">We appreciate your patience and understanding.</p>
          <p style="font-size:14px;line-height:10px;margin:16px 0;color:rgb(0,0,0)">Sincerely,</p>
          <p style="font-size:14px;line-height:10px;margin:16px 0;color:rgb(0,0,0)">The <strong>Pick My Course</strong> Team</p>
        </td>
      </tr>
    </table>
  </body>
</html>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "Ticket created successfully",
      Ticket: newTicket.ticketId,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.put("/api/ticketupdate", async (req, res) => {
  const { ticketId } = req.query;
  const { desc2, status, team } = req.body;

  try {
    const updatedTicket = await Ticket.findOneAndUpdate(
      { ticketId: ticketId },
      { desc2, status, team },
      { new: true }
    );

    if (!updatedTicket) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }

    res.status(200).json({
      success: true,
      message: "Ticket updated successfully",
      Ticket: updatedTicket,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.delete("/api/deleteticket", async (req, res) => {
  const { ticketId } = req.query;

  try {
    const deletedTicket = await Ticket.findOneAndDelete({ ticketId });

    if (!deletedTicket) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }

    res.status(200).json({
      success: true,
      message: "Ticket deleted successfully",
      Ticket: deletedTicket,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.get("/api/getticket", async (req, res) => {
  try {
    const ticket = await Ticket.find();
    res.status(200).json({ success: true, ticket: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/getticketbyid", async (req, res) => {
  const { ticketId } = req.query;
  try {
    const ticket = await Ticket.findOne({ ticketId });
    res.status(200).json({ success: true, ticket: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/getticketuserbyid", async (req, res) => {
  const { user } = req.query;
  try {
    const ticket = await Ticket.find({user});
    res.status(200).json({ success: true, ticket: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//category
app.post("/api/category", async (req, res) => {
  const { category } = req.body;
  try {
    const newCategory = new Category({ category });
    await newCategory.save();
    res.status(200).json({
      success: true,
      message: "Category created successfully",
      Category: newCategory,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.put("/api/category/:id", async (req, res) => {
  const { id } = req.params;
  const { category } = req.body;

  try {
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { category },
      { new: true, runValidators: true } // Returns the updated document and runs validators
    );

    if (!updatedCategory) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      Category: updatedCategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.delete("/api/category/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deletedCategory = await Category.findByIdAndDelete(id);

    if (!deletedCategory) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
      Category: deletedCategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.get("/api/getcategory", async (req, res) => {
  try {
    const cate = await Category.find();
    res.status(200).json({ success: true, cate: cate });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//notify

app.post("/api/notify", async (req, res) => {
  const { user,subject,description,read } = req.body;
  try {
    const newNotify = new Notify({ user,subject,description,read:'no' });
    await newNotify.save();
    res.status(200).json({
      success: true,
      message: "Notify created successfully",
      Priority: newNotify,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/getnotify", async (req, res) => {
  try {
    const notify = await Notify.find();
    res.status(200).json({ success: true, notify: notify });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/getnotifybyid", async (req, res) => {
  const { user } = req.query; 
  try {
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User query parameter is required" });
    }
    const notify = await Notify.find({ user });

    if (notify.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No notifications found for this user" });
    }

    res.status(200).json({ success: true, notify });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.put("/api/updatenotify", async (req, res) => {
  const { user } = req.query;

  try {
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User query parameter is required" });
    }

    // Update all notifications where the `user` matches, setting `read` to "yes"
    const result = await Notify.updateMany({ user }, { $set: { read: "yes" } });

    if (result.modifiedCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No notifications found to update for this user" });
    }

    res.status(200).json({
      success: true,
      message: "Notifications updated successfully",
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error updating notifications:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});



//priority
app.post("/api/priority", async (req, res) => {
  const { priority } = req.body;
  try {
    const newPriority = new Priority({ priority });
    await newPriority.save();
    res.status(200).json({
      success: true,
      message: "Priority created successfully",
      Priority: newPriority,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.put("/api/priority/:id", async (req, res) => {
  const { id } = req.params;
  const { priority } = req.body;

  try {
    const updatedpriority = await Priority.findByIdAndUpdate(
      id,
      { priority },
      { new: true, runValidators: true } // Returns the updated document and runs validators
    );

    if (!updatedpriority) {
      return res
        .status(404)
        .json({ success: false, message: "priority not found" });
    }

    res.status(200).json({
      success: true,
      message: "priority updated successfully",
      priority: updatedpriority,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.delete("/api/priority/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deletedPriority = await Priority.findByIdAndDelete(id);

    if (!deletedPriority) {
      return res
        .status(404)
        .json({ success: false, message: "Priority not found" });
    }

    res.status(200).json({
      success: true,
      message: "Priority deleted successfully",
      Priority: deletedPriority,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.get("/api/getpriority", async (req, res) => {
  try {
    const priority = await Priority.find();
    res.status(200).json({ success: true, priority: priority });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//status
app.post("/api/status", async (req, res) => {
  const { status, color } = req.body;
  try {
    const newStatus = new Status({ status, color });
    await newStatus.save();
    res.status(200).json({
      success: true,
      message: "newStatus created successfully",
      Status: newStatus,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.put("/api/status/:id", async (req, res) => {
  const { id } = req.params;
  const { status, color } = req.body;

  try {
    const updatedStatus = await Status.findByIdAndUpdate(
      id,
      { status, color },
      { new: true, runValidators: true }
    );

    if (!updatedStatus) {
      return res
        .status(404)
        .json({ success: false, message: "Status not found" });
    }

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
      Status: updatedStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.delete("/api/status/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deletedStatus = await Status.findByIdAndDelete(id);

    if (!deletedStatus) {
      return res
        .status(404)
        .json({ success: false, message: "Status not found" });
    }

    res.status(200).json({
      success: true,
      message: "Status deleted successfully",
      Status: deletedStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.get("/api/getstatus", async (req, res) => {
  try {
    const status = await Status.find();
    res.status(200).json({ success: true, status: status });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//tax

app.post("/api/tax", async (req, res) => {
  const { taxname, percentage } = req.body;
  try {
    const newTax = new Tax({ taxname, percentage });
    await newTax.save();
    res.status(200).json({
      success: true,
      message: "Tax created successfully",
      tax: newTax,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.put("/api/taxupdate/:id", async (req, res) => {
  const { id } = req.params;
  const { taxname, percentage } = req.body;

  try {
    const updatedTax = await Tax.findByIdAndUpdate(
      id,
      { taxname, percentage },
      { new: true, runValidators: true } // Returns the updated document and runs validators
    );

    if (!updatedTax) {
      return res.status(404).json({ success: false, message: "Tax not found" });
    }

    res.status(200).json({
      success: true,
      message: "Tax updated successfully",
      tax: updatedTax,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.delete("/api/tax/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deletedTax = await Tax.findByIdAndDelete(id);

    if (!deletedTax) {
      return res.status(404).json({ success: false, message: "Tax not found" });
    }

    res.status(200).json({
      success: true,
      message: "Tax deleted successfully",
      tax: deletedTax,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

app.get("/api/gettax", async (req, res) => {
  try {
    const tax = await Tax.find();
    res.status(200).json({ success: true, tax: tax });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//GET DATA FROM MODEL
app.post("/api/prompt", async (req, res) => {
  const receivedData = req.body;

  const promptString = receivedData.prompt;

  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    safetySettings,
  });

  const prompt = promptString;

  await model
    .generateContent(prompt)
    .then((result) => {
      const response = result.response;
      const generatedText = response.text();
      res.status(200).json({ generatedText });
    })
    .catch((error) => {
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    });
});

//GET GENERATE THEORY
app.post("/api/generate", async (req, res) => {
  const receivedData = req.body;

  const promptString = receivedData.prompt;

  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    safetySettings,
  });

  const prompt = promptString;

  await model
    .generateContent(prompt)
    .then((result) => {
      const response = result.response;
      const txt = response.text();
      const converter = new showdown.Converter();
      const markdownText = txt;
      const text = converter.makeHtml(markdownText);
      res.status(200).json({ text });
    })
    .catch((error) => {
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    });
});

//GET IMAGE
app.post("/api/image", async (req, res) => {
  const receivedData = req.body;
  const promptString = receivedData.prompt;
  gis(promptString, logResults);
  function logResults(error, results) {
    if (error) {
      //ERROR
    } else {
      res.status(200).json({ url: results[0].url });
    }
  }
});

//GET VIDEO
app.post("/api/yt", async (req, res) => {
  try {
    const receivedData = req.body;
    const promptString = receivedData.prompt;
    const video = await youtubesearchapi.GetListByKeyword(
      promptString,
      [false],
      [1],
      [{ type: "video" }]
    );
    const videoId = await video.items[0].id;
    res.status(200).json({ url: videoId });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//GET TRANSCRIPT
app.post("/api/transcript", async (req, res) => {
  const receivedData = req.body;
  const promptString = receivedData.prompt;
  YoutubeTranscript.fetchTranscript(promptString)
    .then((video) => {
      res.status(200).json({ url: video });
    })
    .catch((error) => {
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    });
});

//STORE COURSE
app.post("/api/course", async (req, res) => {
  const { user, fname, lname, email, phone, content, type, mainTopic } =
    req.body;

  unsplash.search
    .getPhotos({
      query: mainTopic,
      page: 1,
      perPage: 1,
      orientation: "landscape",
    })
    .then(async (result) => {
      const photos = result.response.results;
      const photo = photos[0].urls.regular;
      try {
        const newCourse = new Course({
          user,
          fname,
          lname,
          email,
          phone,
          content,
          type,
          mainTopic,
          photo,
        });
        await newCourse.save();

        const mailOptions = {
          from: process.env.EMAIL,
          to: email,
          subject: `Welcome to Pick My Course!`,
          html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
                    <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
                    <html lang="en">
                    
                      <head></head>
                     <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Your Pick My Course is Ready!<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
                     </div>
                    
                     <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: Arial, sans-serif;">
    <table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; border: 1px solid #eaeaea; border-radius: 8px; padding: 20px;">
      <tr>
        <td style="text-align: center;">
          <h1 style="font-size: 24px; font-weight: bold; margin: 20px 0; color: #000000;">Your Pick My Course is Ready!</h1>
        </td>
      </tr>
      <tr>
        <td style="font-size: 16px; color: #000000; line-height: 1.2;">
          <p>Hi <strong>${fname} ${lname}</strong>,</p>
          <p>Your course <strong>"${mainTopic}"</strong> is ready to go!</p>
          <p style="font-size: 16px; color: #000000;">Start learning now and achieve your goals.</p>
          <p style="font-size: 16px; color: #000000;">Need help? Our AI tutor is always available to answer your questions.</p>
        </td>
      </tr>
      <tr>
        <td><a href="https://app.pickmycourse.ai" target="_blank" style="p-x:20px;p-y:12px;line-height:100%;text-decoration:none;display:inline-block;max-width:100%;padding:12px 20px;border-radius:0.25rem;background-color:rgb(0,0,0);text-align:center;font-size:12px;font-weight:600;color:rgb(255,255,255);text-decoration-line:none"><span></span><span style="p-x:20px;p-y:12px;max-width:100%;display:inline-block;line-height:120%;text-decoration:none;text-transform:none;mso-padding-alt:0px;mso-text-raise:9px"</span><span>Start Learning</span></a></td>
      </tr>                  
     <tr style="width:100%">
        <td>
            <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Happy learning!,<p target="_blank" style="color:rgb(0,0,0);text-decoration:none;text-decoration-line:none">The <strong>Pick My Course</strong> Team</p></p>
        </td>
      </tr>
    </table>
  </body>
</html>`,
        };

        await transporter.sendMail(mailOptions);
        res.json({
          success: true,
          message: "Course created successfully",
          courseId: newCourse._id,
        });
      } catch (error) {
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });
});

//UPDATE COURSE
app.post("/api/update", async (req, res) => {
  const { content, courseId } = req.body;
  try {
    await Course.findOneAndUpdate({ _id: courseId }, [
      { $set: { content: content } },
    ])
      .then((result) => {
        res.json({ success: true, message: "Course updated successfully" });
      })
      .catch((error) => {
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/finish", async (req, res) => {
  const { courseId } = req.body;
  try {
    await Course.findOneAndUpdate(
      { _id: courseId },
      { $set: { completed: true, end: Date.now() } }
    )
      .then((result) => {
        res.json({ success: true, message: "Course completed successfully" });
      })
      .catch((error) => {
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//SEND CERTIFICATE
app.post("/api/sendcertificate", async (req, res) => {
  const { html, email } = req.body;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    service: "gmail",
    secure: true,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
    },
  });

  const options = {
    from: process.env.EMAIL,
    to: email,
    subject: "Certification of completion",
    html: html,
  };

  transporter.sendMail(options, (error, info) => {
    if (error) {
      res.status(500).json({ success: false, message: "Failed to send email" });
    } else {
      res.json({ success: true, message: "Email sent successfully" });
    }
  });
});

//GET ALL COURSES
app.get("/api/courses", async (req, res) => {
  try {
    const { userId } = req.query;
    await Course.find({ user: userId }).then((result) => {
      res.json(result);
    });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

//Delete

app.delete("/api/deletecourse/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deleteCourse = await Course.findByIdAndDelete(id);

    if (!deleteCourse) {
      return res
        .status(404)
        .json({ success: false, message: "Delete not found" });
    }

    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
      deleteCourse: deleteCourse,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

//GET PROFILE DETAILS
app.post("/api/profile", async (req, res) => {
  const { email, mName, password, uid } = req.body;
  try {
    if (password === "") {
      await User.findOneAndUpdate(
        { _id: uid },
        { $set: { email: email, mName: mName } }
      )
        .then((result) => {
          res.json({ success: true, message: "Profile Updated" });
        })
        .catch((error) => {
          res
            .status(500)
            .json({ success: false, message: "Internal server error" });
        });
    } else {
      await User.findOneAndUpdate(
        { _id: uid },
        { $set: { email: email, mName: mName, password: password } }
      )
        .then((result) => {
          res.json({ success: true, message: "Profile Updated" });
        })
        .catch((error) => {
          res
            .status(500)
            .json({ success: false, message: "Internal server error" });
        });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//PAYPAL PAYMENT
app.post("/api/paypal", async (req, res) => {
  const {
    planId,
    email,
    name,
    lastName,
    post,
    address,
    country,
    brand,
    admin,
  } = req.body;

  const firstLine = address.split(",").slice(0, -1).join(",");
  const secondLine = address.split(",").pop();

  const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
  const PAYPAL_APP_SECRET_KEY = process.env.PAYPAL_APP_SECRET_KEY;
  const auth = Buffer.from(
    PAYPAL_CLIENT_ID + ":" + PAYPAL_APP_SECRET_KEY
  ).toString("base64");
  const setSubscriptionPayload = (subscriptionPlanID) => {
    let subscriptionPayload = {
      plan_id: subscriptionPlanID,
      subscriber: {
        name: { given_name: name, surname: lastName },
        email_address: email,
        shipping_address: {
          name: { full_name: name },
          address: {
            address_line_1: firstLine,
            address_line_2: secondLine,
            admin_area_2: admin,
            admin_area_1: country,
            postal_code: post,
            country_code: country,
          },
        },
      },
      application_context: {
        brand_name: process.env.COMPANY,
        locale: "en-US",
        shipping_preference: "SET_PROVIDED_ADDRESS",
        user_action: "SUBSCRIBE_NOW",
        payment_method: {
          payer_selected: "PAYPAL",
          payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
        },
        return_url: `${process.env.WEBSITE_URL}/success`,
        cancel_url: `${process.env.WEBSITE_URL}/failed`,
      },
    };
    return subscriptionPayload;
  };

  let subscriptionPlanID = planId;
  const response = await fetch(
    "https://api-m.paypal.com/v1/billing/subscriptions",
    {
      method: "POST",
      body: JSON.stringify(setSubscriptionPayload(subscriptionPlanID)),
      headers: {
        Authorization: "Basic " + auth,
        "Content-Type": "application/json",
      },
    }
  );
  const session = await response.json();
  res.send(session);
});

//GET SUBSCRIPTION DETAILS
app.post("/api/subscriptiondetail", async (req, res) => {
  try {
    const { uid } = req.body;

    const userDetails = await Subscription.findOne({ user: uid });
    if (userDetails.method === "stripe") {
      const subscription = await stripe.subscriptions.retrieve(
        userDetails.subscriberId
      );

      res.json({ session: subscription, method: userDetails.method });
    } else if (userDetails.method === "paypal") {
      const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
      const PAYPAL_APP_SECRET_KEY = process.env.PAYPAL_APP_SECRET_KEY;
      const auth = Buffer.from(
        PAYPAL_CLIENT_ID + ":" + PAYPAL_APP_SECRET_KEY
      ).toString("base64");
      const response = await fetch(
        `https://api-m.paypal.com/v1/billing/subscriptions/${userDetails.subscription}`,
        {
          headers: {
            Authorization: "Basic " + auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );
      const session = await response.json();
      res.json({ session: session, method: userDetails.method });
    } else if (userDetails.method === "paystack") {
      const authorization = `Bearer ${process.env.PAYSTACK_SECRET_KEY}`;
      const response = await axios.get(
        `https://api.paystack.co/subscription/${userDetails.subscriberId}`,
        {
          headers: {
            Authorization: authorization,
          },
        }
      );

      let subscriptionDetails = null;
      subscriptionDetails = {
        subscription_code: response.data.data.subscription_code,
        createdAt: response.data.data.createdAt,
        updatedAt: response.data.data.updatedAt,
        customer_code: userDetails.subscription,
        email_token: response.data.data.email_token,
      };

      res.json({ session: subscriptionDetails, method: userDetails.method });
    } else {
      console.log("raz");
      const YOUR_KEY_ID = process.env.RAZORPAY_KEY_ID;
      const YOUR_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
      const SUBSCRIPTION_ID = userDetails.subscription;

      const config = {
        headers: {
          "Content-Type": "application/json",
        },
        auth: {
          username: YOUR_KEY_ID,
          password: YOUR_KEY_SECRET,
        },
      };

      axios
        .get(
          `https://api.razorpay.com/v1/subscriptions/${SUBSCRIPTION_ID}`,
          config
        )
        .then((response) => {
          res.json({ session: response.data, method: userDetails.method });
        })
        .catch((error) => {
          console.log(error);
        });
    }
  } catch (error) {
    //DO NOTHING
  }
});

//GET PAYPAL DETAILS
app.post("/api/paypaldetails", async (req, res) => {
  const { subscriberId, uid, plan } = req.body;

  let cost = 0;
  if (plan === process.env.MONTH_TYPE) {
    cost = process.env.MONTH_COST;
  } else {
    cost = process.env.YEAR_COST;
  }
  cost = cost / 4;

  await Admin.findOneAndUpdate({ type: "main" }, { $inc: { total: cost } });

  await User.findOneAndUpdate({ _id: uid }, { $set: { type: plan } })
    .then(async (result) => {
      const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
      const PAYPAL_APP_SECRET_KEY = process.env.PAYPAL_APP_SECRET_KEY;
      const auth = Buffer.from(
        PAYPAL_CLIENT_ID + ":" + PAYPAL_APP_SECRET_KEY
      ).toString("base64");
      const response = await fetch(
        `https://api-m.paypal.com/v1/billing/subscriptions/${subscriberId}`,
        {
          headers: {
            Authorization: "Basic " + auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );
      const session = await response.json();
      res.send(session);
    })
    .catch((error) => {
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    });
});

//DOWNLOAD RECEIPT
app.post("/api/downloadreceipt", async (req, res) => {
  const { html, email } = req.body;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    service: "gmail",
    secure: true,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
    },
  });

  const options = {
    from: process.env.EMAIL,
    to: email,
    subject: "Subscription Receipt",
    html: html,
  };

  transporter.sendMail(options, (error, info) => {
    if (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to send receipt" });
    } else {
      res.json({ success: true, message: "Receipt sent to your mail" });
    }
  });
});

//SEND RECEIPT
app.post("/api/sendreceipt", async (req, res) => {
  const { html, email, plan, subscriberId, user, method, subscription } =
    req.body;

  const existingSubscription = await Subscription.findOne({ user: user });
  if (existingSubscription) {
    //DO NOTHING
  } else {
    const newSub = new Subscription({
      user,
      subscription,
      subscriberId,
      plan,
      method,
    });
    await newSub.save();
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    service: "gmail",
    secure: true,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
    },
  });

  const options = {
    from: process.env.EMAIL,
    to: email,
    subject: "Subscription Receipt",
    html: html,
  };

  transporter.sendMail(options, (error, info) => {
    if (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to send receipt" });
    } else {
      res.json({ success: true, message: "Receipt sent to your mail" });
    }
  });
});

//PAYPAL WEBHOOKS
app.post("/api/paypalwebhooks", async (req, res) => {
  const body = req.body;
  const event_type = body.event_type;

  switch (event_type) {
    case "BILLING.SUBSCRIPTION.CANCELLED":
      const id = body["resource"]["id"];
      updateSubsciption(id, "Cancelled");
      break;
    case "BILLING.SUBSCRIPTION.EXPIRED":
      const id2 = body["resource"]["id"];
      updateSubsciption(id2, "Expired");
      break;
    case "BILLING.SUBSCRIPTION.SUSPENDED":
      const id3 = body["resource"]["id"];
      updateSubsciption(id3, "Suspended");
      break;
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
      const id4 = body["resource"]["id"];
      updateSubsciption(id4, "Disabled Due To Payment Failure");
      break;
    case "PAYMENT.SALE.COMPLETED":
      const id5 = body["resource"]["billing_agreement_id"];
      sendRenewEmail(id5);
      break;

    default:
    //DO NOTHING
  }
});

//SEND RENEW EMAIL
async function sendRenewEmail(id) {
  try {
    const subscriptionDetails = await Subscription.findOne({
      subscription: id,
    });
    const userId = subscriptionDetails.user;
    const userDetails = await User.findOne({ _id: userId });

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      service: "gmail",
      secure: true,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: userDetails.email,
      subject: `${userDetails.mName} Your Subscription Plan Has Been Renewed`,
      html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
            <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
            <html lang="en">
            
              <head></head>
             <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Subscription Renewed<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
             </div>
            
              <body style="margin-left:auto;margin-right:auto;margin-top:auto;margin-bottom:auto;background-color:rgb(255,255,255);font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, &quot;Noto Sans&quot;, sans-serif, &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;, &quot;Segoe UI Symbol&quot;, &quot;Noto Color Emoji&quot;">
                <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:37.5em;margin-left:auto;margin-right:auto;margin-top:40px;margin-bottom:40px;width:465px;border-radius:0.25rem;border-width:1px;border-style:solid;border-color:rgb(234,234,234);padding:20px">
                  <tr style="width:100%">
                    <td>
                      <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-top:32px">
                        <tbody>
                          <tr>
                            <td><img alt="Vercel" src="${process.env.LOGO}" width="40" height="37" style="display:block;outline:none;border:none;text-decoration:none;margin-left:auto;margin-right:auto;margin-top:0px;margin-bottom:0px" /></td>
                          </tr>
                        </tbody>
                      </table>
                      <h1 style="margin-left:0px;margin-right:0px;margin-top:30px;margin-bottom:30px;padding:0px;text-align:center;font-size:24px;font-weight:400;color:rgb(0,0,0)">Subscription Renewed</h1>
                      <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">${userDetails.mName}, your subscription plan has been Renewed.</p>
                      <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-bottom:32px;margin-top:32px;text-align:center">
                      </table>
                      <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Best,<p target="_blank" style="color:rgb(0,0,0);text-decoration:none;text-decoration-line:none">The <strong>${process.env.COMPANY}</strong> Team</p></p>
                      </td>
                  </tr>
                </table>
              </body>
            
            </html>`,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    //DO NOTHING
  }
}

//UPDATE SUBSCRIPTION DETIALS
async function updateSubsciption(id, subject) {
  try {
    const subscriptionDetails = await Subscription.findOne({
      subscription: id,
    });
    const userId = subscriptionDetails.user;

    await User.findOneAndUpdate({ _id: userId }, { $set: { type: "free" } });

    const userDetails = await User.findOne({ _id: userId });
    await Subscription.findOneAndDelete({ subscription: id });

    sendCancelEmail(userDetails.email, userDetails.mName, subject);
  } catch (error) {
    //DO NOTHING
  }
}

//SEND CANCEL EMAIL
async function sendCancelEmail(email, name, subject) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    service: "gmail",
    secure: true,
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
    },
  });

  const Reactivate = process.env.WEBSITE_URL + "/pricing";

  const mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: `${name} Your Subscription Plan Has Been ${subject}`,
    html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
        <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
        <html lang="en">
        
          <head></head>
         <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Subscription ${subject}<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
         </div>
        
          <body style="margin-left:auto;margin-right:auto;margin-top:auto;margin-bottom:auto;background-color:rgb(255,255,255);font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, &quot;Noto Sans&quot;, sans-serif, &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;, &quot;Segoe UI Symbol&quot;, &quot;Noto Color Emoji&quot;">
            <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:37.5em;margin-left:auto;margin-right:auto;margin-top:40px;margin-bottom:40px;width:465px;border-radius:0.25rem;border-width:1px;border-style:solid;border-color:rgb(234,234,234);padding:20px">
              <tr style="width:100%">
                <td>
                  <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-top:32px">
                    <tbody>
                      <tr>
                        <td><img alt="Vercel" src="${process.env.LOGO}" width="40" height="37" style="display:block;outline:none;border:none;text-decoration:none;margin-left:auto;margin-right:auto;margin-top:0px;margin-bottom:0px" /></td>
                      </tr>
                    </tbody>
                  </table>
                  <h1 style="margin-left:0px;margin-right:0px;margin-top:30px;margin-bottom:30px;padding:0px;text-align:center;font-size:24px;font-weight:400;color:rgb(0,0,0)">Subscription ${subject}</h1>
                  <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">${name}, your subscription plan has been ${subject}. Reactivate your plan by clicking on the button below.</p>
                  <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-bottom:32px;margin-top:32px;text-align:center">
                       <tbody>
                          <tr>
                            <td><a href="${Reactivate}" target="_blank" style="p-x:20px;p-y:12px;line-height:100%;text-decoration:none;display:inline-block;max-width:100%;padding:12px 20px;border-radius:0.25rem;background-color:rgb(0,0,0);text-align:center;font-size:12px;font-weight:600;color:rgb(255,255,255);text-decoration-line:none"><span></span><span style="p-x:20px;p-y:12px;max-width:100%;display:inline-block;line-height:120%;text-decoration:none;text-transform:none;mso-padding-alt:0px;mso-text-raise:9px"</span><span>Reactivate</span></a></td>
                          </tr>
                        </tbody>
                  </table>
                  <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Best,<p target="_blank" style="color:rgb(0,0,0);text-decoration:none;text-decoration-line:none">The <strong>${process.env.COMPANY}</strong> Team</p></p>
                  </td>
              </tr>
            </table>
          </body>
        
        </html>`,
  };

  await transporter.sendMail(mailOptions);
}

//CANCEL PAYPAL SUBSCRIPTION
app.post("/api/paypalcancel", async (req, res) => {
  const { id } = req.body;

  const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
  const PAYPAL_APP_SECRET_KEY = process.env.PAYPAL_APP_SECRET_KEY;
  const auth = Buffer.from(
    PAYPAL_CLIENT_ID + ":" + PAYPAL_APP_SECRET_KEY
  ).toString("base64");
  await fetch(
    `https://api-m.paypal.com/v1/billing/subscriptions/${id}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + auth,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ reason: "Not satisfied with the service" }),
    }
  ).then(async (resp) => {
    try {
      const subscriptionDetails = await Subscription.findOne({
        subscription: id,
      });
      const userId = subscriptionDetails.user;

      await User.findOneAndUpdate({ _id: userId }, { $set: { type: "free" } });

      const userDetails = await User.findOne({ _id: userId });
      await Subscription.findOneAndDelete({ subscription: id });

      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        service: "gmail",
        secure: true,
        auth: {
          user: process.env.EMAIL,
          pass: process.env.PASSWORD,
        },
      });

      const Reactivate = process.env.WEBSITE_URL + "/pricing";

      const mailOptions = {
        from: process.env.EMAIL,
        to: userDetails.email,
        subject: `${userDetails.mName} Your Subscription Plan Has Been Cancelled`,
        html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
                <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
                <html lang="en">
                
                  <head></head>
                 <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Subscription Cancelled<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
                 </div>
                
                  <body style="margin-left:auto;margin-right:auto;margin-top:auto;margin-bottom:auto;background-color:rgb(255,255,255);font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, &quot;Noto Sans&quot;, sans-serif, &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;, &quot;Segoe UI Symbol&quot;, &quot;Noto Color Emoji&quot;">
                    <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:37.5em;margin-left:auto;margin-right:auto;margin-top:40px;margin-bottom:40px;width:465px;border-radius:0.25rem;border-width:1px;border-style:solid;border-color:rgb(234,234,234);padding:20px">
                      <tr style="width:100%">
                        <td>
                          <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-top:32px">
                            <tbody>
                              <tr>
                                <td><img alt="Vercel" src="${process.env.LOGO}" width="40" height="37" style="display:block;outline:none;border:none;text-decoration:none;margin-left:auto;margin-right:auto;margin-top:0px;margin-bottom:0px" /></td>
                              </tr>
                            </tbody>
                          </table>
                          <h1 style="margin-left:0px;margin-right:0px;margin-top:30px;margin-bottom:30px;padding:0px;text-align:center;font-size:24px;font-weight:400;color:rgb(0,0,0)">Subscription Cancelled</h1>
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">${userDetails.mName}, your subscription plan has been Cancelled. Reactivate your plan by clicking on the button below.</p>
                          <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-bottom:32px;margin-top:32px;text-align:center">
                               <tbody>
                                  <tr>
                                    <td><a href="${Reactivate}" target="_blank" style="p-x:20px;p-y:12px;line-height:100%;text-decoration:none;display:inline-block;max-width:100%;padding:12px 20px;border-radius:0.25rem;background-color:rgb(0,0,0);text-align:center;font-size:12px;font-weight:600;color:rgb(255,255,255);text-decoration-line:none"><span></span><span style="p-x:20px;p-y:12px;max-width:100%;display:inline-block;line-height:120%;text-decoration:none;text-transform:none;mso-padding-alt:0px;mso-text-raise:9px"</span><span>Reactivate</span></a></td>
                                  </tr>
                                </tbody>
                          </table>
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Best,<p target="_blank" style="color:rgb(0,0,0);text-decoration:none;text-decoration-line:none">The <strong>${process.env.COMPANY}</strong> Team</p></p>
                          </td>
                      </tr>
                    </table>
                  </body>
                
                </html>`,
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: "" });
    } catch (error) {
      //DO NOTHING
    }
  });
});

//UPDATE SUBSCRIPTION
app.post("/api/paypalupdate", async (req, res) => {
  const { id, idPlan } = req.body;

  const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
  const PAYPAL_APP_SECRET_KEY = process.env.PAYPAL_APP_SECRET_KEY;
  const auth = Buffer.from(
    PAYPAL_CLIENT_ID + ":" + PAYPAL_APP_SECRET_KEY
  ).toString("base64");

  try {
    const response = await fetch(
      `https://api-m.paypal.com/v1/billing/subscriptions/${id}/revise`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: idPlan,
          application_context: {
            brand_name: process.env.COMPANY,
            locale: "en-US",
            payment_method: {
              payer_selected: "PAYPAL",
              payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
            },
            return_url: `${process.env.WEBSITE_URL}/successful`,
            cancel_url: `${process.env.WEBSITE_URL}/failed`,
          },
        }),
      }
    );
    const session = await response.json();
    res.send(session);
  } catch (error) {
    //DO NOTHING
  }
});

//UPDATE SUBSCRIPTION AND USER DETAILS
app.post("/api/paypalupdateuser", async (req, res) => {
  const { id, mName, email, user, plan } = req.body;

  await Subscription.findOneAndUpdate(
    { subscription: id },
    { $set: { plan: plan } }
  ).then(async (r) => {
    await User.findOneAndUpdate({ _id: user }, { $set: { type: plan } }).then(
      async (ress) => {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          service: "gmail",
          secure: true,
          auth: {
            user: process.env.EMAIL,
            pass: process.env.PASSWORD,
          },
        });

        const mailOptions = {
          from: process.env.EMAIL,
          to: email,
          subject: `${mName} Your Subscription Plan Has Been Modifed`,
          html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
                <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
                <html lang="en">
    
                  <head></head>
                 <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Subscription Modifed<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
                 </div>
    
                  <body style="margin-left:auto;margin-right:auto;margin-top:auto;margin-bottom:auto;background-color:rgb(255,255,255);font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, &quot;Noto Sans&quot;, sans-serif, &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;, &quot;Segoe UI Symbol&quot;, &quot;Noto Color Emoji&quot;">
                    <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:37.5em;margin-left:auto;margin-right:auto;margin-top:40px;margin-bottom:40px;width:465px;border-radius:0.25rem;border-width:1px;border-style:solid;border-color:rgb(234,234,234);padding:20px">
                      <tr style="width:100%">
                        <td>
                          <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-top:32px">
                            <tbody>
                              <tr>
                                <td><img alt="Vercel" src="${process.env.LOGO}" width="40" height="37" style="display:block;outline:none;border:none;text-decoration:none;margin-left:auto;margin-right:auto;margin-top:0px;margin-bottom:0px" /></td>
                              </tr>
                            </tbody>
                          </table>
                          <h1 style="margin-left:0px;margin-right:0px;margin-top:30px;margin-bottom:30px;padding:0px;text-align:center;font-size:24px;font-weight:400;color:rgb(0,0,0)">Subscription Modifed</h1>
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">${mName}, your subscription plan has been Modifed.</p>
                          <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-bottom:32px;margin-top:32px;text-align:center">
                          </table>
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Best,<p target="_blank" style="color:rgb(0,0,0);text-decoration:none;text-decoration-line:none">The <strong>${process.env.COMPANY}</strong> Team</p></p>
                          </td>
                      </tr>
                    </table>
                  </body>
    
                </html>`,
        };

        await transporter.sendMail(mailOptions);
      }
    );
  });
});

//CREATE RAZORPAY SUBSCRIPTION
app.post("/api/razorpaycreate", async (req, res) => {
  const { plan, email, fullAddress } = req.body;
  try {
    const YOUR_KEY_ID = process.env.RAZORPAY_KEY_ID;
    const YOUR_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

    const requestBody = {
      plan_id: plan,
      total_count: 12,
      quantity: 1,
      customer_notify: 1,
      notes: {
        notes_key_1: fullAddress,
      },
      notify_info: {
        notify_email: email,
      },
    };

    const config = {
      headers: {
        "Content-Type": "application/json",
      },
      auth: {
        username: YOUR_KEY_ID,
        password: YOUR_KEY_SECRET,
      },
    };

    const requestData = JSON.stringify(requestBody);

    axios
      .post("https://api.razorpay.com/v1/subscriptions", requestData, config)
      .then((response) => {
        res.send(response.data);
      })
      .catch((error) => {
        //DO NOTHING
      });
  } catch (error) {
    //DO NOTHING
  }
});

//GET RAZORPAY SUBSCRIPTION DETAILS
app.post("/api/razorapydetails", async (req, res) => {
  const { subscriberId, uid, plan } = req.body;

  let cost = 0;
  if (plan === process.env.MONTH_TYPE) {
    cost = process.env.MONTH_COST;
  } else {
    cost = process.env.YEAR_COST;
  }
  cost = cost / 4;

  await Admin.findOneAndUpdate({ type: "main" }, { $inc: { total: cost } });

  await User.findOneAndUpdate({ _id: uid }, { $set: { type: plan } })
    .then(async (result) => {
      const YOUR_KEY_ID = process.env.RAZORPAY_KEY_ID;
      const YOUR_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
      const SUBSCRIPTION_ID = subscriberId;

      const config = {
        headers: {
          "Content-Type": "application/json",
        },
        auth: {
          username: YOUR_KEY_ID,
          password: YOUR_KEY_SECRET,
        },
      };

      axios
        .get(
          `https://api.razorpay.com/v1/subscriptions/${SUBSCRIPTION_ID}`,
          config
        )
        .then((response) => {
          res.send(response.data);
        })
        .catch((error) => {
          //DO NOTHING
        });
    })
    .catch((error) => {
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    });
});

//RAZORPAY PENDING
app.post("/api/razorapypending", async (req, res) => {
  const { sub } = req.body;

  const YOUR_KEY_ID = process.env.RAZORPAY_KEY_ID;
  const YOUR_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
  const SUBSCRIPTION_ID = sub;

  const config = {
    headers: {
      "Content-Type": "application/json",
    },
    auth: {
      username: YOUR_KEY_ID,
      password: YOUR_KEY_SECRET,
    },
  };

  axios
    .get(`https://api.razorpay.com/v1/subscriptions/${SUBSCRIPTION_ID}`, config)
    .then((response) => {
      res.send(response.data);
    })
    .catch((error) => {
      //DO NOTHING
    });
});

//RAZORPAY CANCEL SUBSCRIPTION
app.post("/api/razorpaycancel", async (req, res) => {
  const { id } = req.body;

  const YOUR_KEY_ID = process.env.RAZORPAY_KEY_ID;
  const YOUR_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
  const SUBSCRIPTION_ID = id;

  const requestBody = {
    cancel_at_cycle_end: 0,
  };

  const config = {
    headers: {
      "Content-Type": "application/json",
    },
    auth: {
      username: YOUR_KEY_ID,
      password: YOUR_KEY_SECRET,
    },
  };

  axios
    .post(
      `https://api.razorpay.com/v1/subscriptions/${SUBSCRIPTION_ID}/cancel`,
      requestBody,
      config
    )
    .then(async (resp) => {
      try {
        const subscriptionDetails = await Subscription.findOne({
          subscription: id,
        });
        const userId = subscriptionDetails.user;

        await User.findOneAndUpdate(
          { _id: userId },
          { $set: { type: "free" } }
        );

        const userDetails = await User.findOne({ _id: userId });
        await Subscription.findOneAndDelete({ subscription: id });

        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          service: "gmail",
          secure: true,
          auth: {
            user: process.env.EMAIL,
            pass: process.env.PASSWORD,
          },
        });

        const Reactivate = process.env.WEBSITE_URL + "/pricing";

        const mailOptions = {
          from: process.env.EMAIL,
          to: userDetails.email,
          subject: `${userDetails.mName} Your Subscription Plan Has Been Cancelled`,
          html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
                    <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
                    <html lang="en">
                    
                      <head></head>
                     <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Subscription Cancelled<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
                     </div>
                    
                      <body style="margin-left:auto;margin-right:auto;margin-top:auto;margin-bottom:auto;background-color:rgb(255,255,255);font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, &quot;Noto Sans&quot;, sans-serif, &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;, &quot;Segoe UI Symbol&quot;, &quot;Noto Color Emoji&quot;">
                        <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:37.5em;margin-left:auto;margin-right:auto;margin-top:40px;margin-bottom:40px;width:465px;border-radius:0.25rem;border-width:1px;border-style:solid;border-color:rgb(234,234,234);padding:20px">
                          <tr style="width:100%">
                            <td>
                              <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-top:32px">
                                <tbody>
                                  <tr>
                                    <td><img alt="Vercel" src="${process.env.LOGO}" width="40" height="37" style="display:block;outline:none;border:none;text-decoration:none;margin-left:auto;margin-right:auto;margin-top:0px;margin-bottom:0px" /></td>
                                  </tr>
                                </tbody>
                              </table>
                              <h1 style="margin-left:0px;margin-right:0px;margin-top:30px;margin-bottom:30px;padding:0px;text-align:center;font-size:24px;font-weight:400;color:rgb(0,0,0)">Subscription Cancelled</h1>
                              <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">${userDetails.mName}, your subscription plan has been Cancelled. Reactivate your plan by clicking on the button below.</p>
                              <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-bottom:32px;margin-top:32px;text-align:center">
                                   <tbody>
                                      <tr>
                                        <td><a href="${Reactivate}" target="_blank" style="p-x:20px;p-y:12px;line-height:100%;text-decoration:none;display:inline-block;max-width:100%;padding:12px 20px;border-radius:0.25rem;background-color:rgb(0,0,0);text-align:center;font-size:12px;font-weight:600;color:rgb(255,255,255);text-decoration-line:none"><span></span><span style="p-x:20px;p-y:12px;max-width:100%;display:inline-block;line-height:120%;text-decoration:none;text-transform:none;mso-padding-alt:0px;mso-text-raise:9px"</span><span>Reactivate</span></a></td>
                                      </tr>
                                    </tbody>
                              </table>
                              <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Best,<p target="_blank" style="color:rgb(0,0,0);text-decoration:none;text-decoration-line:none">The <strong>${process.env.COMPANY}</strong> Team</p></p>
                              </td>
                          </tr>
                        </table>
                      </body>
                    
                    </html>`,
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: "" });
      } catch (error) {
        //DO NOTHING
      }
    })
    .catch((error) => {
      //DO NOTHING
    });
});

//CONTACT
app.post("/api/contact", async (req, res) => {
  const { fname, lname, email, phone, msg } = req.body;
  try {
    const newContact = new Contact({ fname, lname, email, phone, msg });
    await newContact.save();
    res.json({ success: true, message: "Submitted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

//ADMIN PANEL

//DASHBOARD
app.post("/api/dashboard", async (req, res) => {
  const users = await User.estimatedDocumentCount();
  const courses = await Course.estimatedDocumentCount();
  const admin = await Admin.findOne({ type: "main" });
  const total = admin.total;
  const monthlyPlanCount = await User.countDocuments({
    type: process.env.MONTH_TYPE,
  });
  const yearlyPlanCount = await User.countDocuments({
    type: process.env.YEAR_TYPE,
  });
  let monthCost = monthlyPlanCount * process.env.MONTH_COST;
  let yearCost = yearlyPlanCount * process.env.YEAR_COST;
  let sum = monthCost + yearCost;
  let paid = yearlyPlanCount + monthlyPlanCount;
  const videoType = await Course.countDocuments({
    type: "video & text course",
  });
  const textType = await Course.countDocuments({
    type: "theory & image course",
  });
  let free = users - paid;
  res.json({
    users: users,
    courses: courses,
    total: total,
    sum: sum,
    paid: paid,
    videoType: videoType,
    textType: textType,
    free: free,
    admin: admin,
  });
});

//GET COURES
app.get("/api/getcourses", async (req, res) => {
  try {
    const courses = await Course.find({});
    res.json(courses);
  } catch (error) {
    //DO NOTHING
  }
});

//GET PAID USERS
app.get("/api/getpaid", async (req, res) => {
  try {
    const paidUsers = await User.find({ type: { $ne: "free" } });
    res.json(paidUsers);
  } catch (error) {
    //DO NOTHING
  }
});

//GET ADMINS
// app.get('/api/getadmins', async (req, res) => {
//     try {
//         const users = await User.find({ email: { $nin: await getEmailsOfAdmins() } });
//         const admins = await Admin.find({});
//         res.json({ users: users, admins: admins });
//     } catch (error) {
//         //DO NOTHING
//     }
// });

async function getEmailsOfAdmins() {
  const admins = await Admin.find({});
  return admins.map((admin) => admin.email);
}

//ADD ADMIN
app.post("/api/addadmin", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email });
    const newAdmin = new Admin({
      email: user.email,
      mName: user.mName,
      type: "no",
    });
    await newAdmin.save();
    res.json({ success: true, message: "Admin added successfully" });
  } catch (error) {
    //DO NOTHING
  }
});

//REMOVE ADMIN
app.post("/api/removeadmin", async (req, res) => {
  const { email } = req.body;
  try {
    await Admin.findOneAndDelete({ email: email });
    res.json({ success: true, message: "Admin removed successfully" });
  } catch (error) {
    //DO NOTHING
  }
});

//GET CONTACTS
app.get("/api/getcontact", async (req, res) => {
  try {
    const contacts = await Contact.find({});
    res.json(contacts);
  } catch (error) {
    //DO NOTHING
  }
});

//SAVE ADMIN
app.post("/api/saveadmin", async (req, res) => {
  const { data, type } = req.body;
  try {
    if (type === "terms") {
      await Admin.findOneAndUpdate(
        { type: "main" },
        { $set: { terms: data } }
      ).then((rl) => {
        res.json({ success: true, message: "Saved successfully" });
      });
    } else if (type === "privacy") {
      await Admin.findOneAndUpdate(
        { type: "main" },
        { $set: { privacy: data } }
      ).then((rl) => {
        res.json({ success: true, message: "Saved successfully" });
      });
    } else if (type === "cancel") {
      await Admin.findOneAndUpdate(
        { type: "main" },
        { $set: { cancel: data } }
      ).then((rl) => {
        res.json({ success: true, message: "Saved successfully" });
      });
    } else if (type === "refund") {
      await Admin.findOneAndUpdate(
        { type: "main" },
        { $set: { refund: data } }
      ).then((rl) => {
        res.json({ success: true, message: "Saved successfully" });
      });
    } else if (type === "billing") {
      await Admin.findOneAndUpdate(
        { type: "main" },
        { $set: { billing: data } }
      ).then((rl) => {
        res.json({ success: true, message: "Saved successfully" });
      });
    }
  } catch (error) {
    //DO NOTHING
  }
});

//GET POLICIES
app.get("/api/policies", async (req, res) => {
  try {
    const admins = await Admin.find({});
    res.json(admins);
  } catch (error) {
    //DO NOTHING
  }
});

//STRIPE PAYMENT
app.post("/api/stripepayment", async (req, res) => {
  const { planId } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      success_url: `${process.env.WEBSITE_URL}/success`,
      cancel_url: `${process.env.WEBSITE_URL}/failed`,
      line_items: [
        {
          price: planId,
          quantity: 1,
        },
      ],
      mode: "subscription",
    });

    res.json({ url: session.url, id: session.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/stripedetails", async (req, res) => {
  const { subscriberId, uid, plan } = req.body;

  let cost = 0;
  if (plan === process.env.MONTH_TYPE) {
    cost = process.env.MONTH_COST;
  } else {
    cost = process.env.YEAR_COST;
  }
  cost = cost / 4;

  await Admin.findOneAndUpdate({ type: "main" }, { $inc: { total: cost } });

  await User.findOneAndUpdate({ _id: uid }, { $set: { type: plan } })
    .then(async (result) => {
      const session = await stripe.checkout.sessions.retrieve(subscriberId);
      res.send(session);
    })
    .catch((error) => {
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    });
});

app.post("/api/stripecancel", async (req, res) => {
  const { id } = req.body;

  const subscription = await stripe.subscriptions.cancel(id);

  try {
    const subscriptionDetails = await Subscription.findOne({
      subscriberId: id,
    });
    const userId = subscriptionDetails.user;

    await User.findOneAndUpdate({ _id: userId }, { $set: { type: "free" } });

    const userDetails = await User.findOne({ _id: userId });
    await Subscription.findOneAndDelete({ subscriberId: id });

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      service: "gmail",
      secure: true,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
      },
    });

    const Reactivate = process.env.WEBSITE_URL + "/pricing";

    const mailOptions = {
      from: process.env.EMAIL,
      to: userDetails.email,
      subject: `${userDetails.mName} Your Subscription Plan Has Been Cancelled`,
      html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
                <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
                <html lang="en">
                
                  <head></head>
                 <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Subscription Cancelled<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
                 </div>
                
                  <body style="margin-left:auto;margin-right:auto;margin-top:auto;margin-bottom:auto;background-color:rgb(255,255,255);font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, &quot;Noto Sans&quot;, sans-serif, &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;, &quot;Segoe UI Symbol&quot;, &quot;Noto Color Emoji&quot;">
                    <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:37.5em;margin-left:auto;margin-right:auto;margin-top:40px;margin-bottom:40px;width:465px;border-radius:0.25rem;border-width:1px;border-style:solid;border-color:rgb(234,234,234);padding:20px">
                      <tr style="width:100%">
                        <td>
                          <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-top:32px">
                            <tbody>
                              <tr>
                                <td><img alt="Vercel" src="${process.env.LOGO}" width="40" height="37" style="display:block;outline:none;border:none;text-decoration:none;margin-left:auto;margin-right:auto;margin-top:0px;margin-bottom:0px" /></td>
                              </tr>
                            </tbody>
                          </table>
                          <h1 style="margin-left:0px;margin-right:0px;margin-top:30px;margin-bottom:30px;padding:0px;text-align:center;font-size:24px;font-weight:400;color:rgb(0,0,0)">Subscription Cancelled</h1>
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">${userDetails.mName}, your subscription plan has been Cancelled. Reactivate your plan by clicking on the button below.</p>
                          <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-bottom:32px;margin-top:32px;text-align:center">
                               <tbody>
                                  <tr>
                                    <td><a href="${Reactivate}" target="_blank" style="p-x:20px;p-y:12px;line-height:100%;text-decoration:none;display:inline-block;max-width:100%;padding:12px 20px;border-radius:0.25rem;background-color:rgb(0,0,0);text-align:center;font-size:12px;font-weight:600;color:rgb(255,255,255);text-decoration-line:none"><span></span><span style="p-x:20px;p-y:12px;max-width:100%;display:inline-block;line-height:120%;text-decoration:none;text-transform:none;mso-padding-alt:0px;mso-text-raise:9px"</span><span>Reactivate</span></a></td>
                                  </tr>
                                </tbody>
                          </table>
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Best,<p target="_blank" style="color:rgb(0,0,0);text-decoration:none;text-decoration-line:none">The <strong>${process.env.COMPANY}</strong> Team</p></p>
                          </td>
                      </tr>
                    </table>
                  </body>
                
                </html>`,
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "" });
  } catch (error) {
    //DO NOTHING
  }
});

//PAYSTACK PAYMENT
app.post("/api/paystackpayment", async (req, res) => {
  const { planId, amountInZar, email } = req.body;
  try {
    const data = {
      email: email,
      amount: amountInZar,
      plan: planId,
    };

    axios
      .post("https://api.paystack.co/transaction/initialize", data, {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      })
      .then((response) => {
        if (response.data.status) {
          const authorizationUrl = response.data.data.authorization_url;
          res.json({ url: authorizationUrl });
        } else {
          res.status(500).json({ error: "Internal Server Error" });
        }
      })
      .catch((error) => {
        res.status(500).json({ error: "Internal Server Error" });
      });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

//PAYSTACK GET DETAIL
app.post("/api/paystackfetch", async (req, res) => {
  const { email, uid, plan } = req.body;
  try {
    const searchEmail = email;
    const url = "https://api.paystack.co/subscription";
    const authorization = `Bearer ${process.env.PAYSTACK_SECRET_KEY}`;

    axios
      .get(url, {
        headers: {
          Authorization: authorization,
        },
      })
      .then(async (response) => {
        const jsonData = response.data;
        let subscriptionDetails = null;
        jsonData.data.forEach((subscription) => {
          if (subscription.customer.email === searchEmail) {
            subscriptionDetails = {
              subscription_code: subscription.subscription_code,
              createdAt: subscription.createdAt,
              updatedAt: subscription.updatedAt,
              customer_code: subscription.customer.customer_code,
            };
          }
        });

        if (subscriptionDetails) {
          let cost = 0;
          if (plan === process.env.MONTH_TYPE) {
            cost = process.env.MONTH_COST;
          } else {
            cost = process.env.YEAR_COST;
          }
          cost = cost / 4;

          await Admin.findOneAndUpdate(
            { type: "main" },
            { $inc: { total: cost } }
          );

          await User.findOneAndUpdate({ _id: uid }, { $set: { type: plan } })
            .then(async (result) => {
              console.log(subscriptionDetails);
              res.json({ details: subscriptionDetails });
            })
            .catch((error) => {
              res
                .status(500)
                .json({ success: false, message: "Internal server error" });
            });
        } else {
          res.status(500).json({ error: "Internal Server Error" });
        }
      })
      .catch((error) => {
        res.status(500).json({ error: "Internal Server Error" });
      });
  } catch (e) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//PAYSTACK PAYMENT
app.post("/api/paystackcancel", async (req, res) => {
  const { code, token, email } = req.body;

  const url = "https://api.paystack.co/subscription/disable";
  const authorization = `Bearer ${process.env.PAYSTACK_SECRET_KEY}`;
  const contentType = "application/json";
  const data = {
    code: code,
    token: token,
  };

  axios
    .post(url, data, {
      headers: {
        Authorization: authorization,
        "Content-Type": contentType,
      },
    })
    .then(async (response) => {
      const subscriptionDetails = await Subscription.findOne({
        subscriberId: code,
      });
      const userId = subscriptionDetails.user;

      await User.findOneAndUpdate({ _id: userId }, { $set: { type: "free" } });

      const userDetails = await User.findOne({ _id: userId });
      await Subscription.findOneAndDelete({ subscriberId: code });

      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        service: "gmail",
        secure: true,
        auth: {
          user: process.env.EMAIL,
          pass: process.env.PASSWORD,
        },
      });

      const Reactivate = process.env.WEBSITE_URL + "/pricing";

      const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: `${userDetails.mName} Your Subscription Plan Has Been Cancelled`,
        html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
                <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
                <html lang="en">
                
                  <head></head>
                 <div id="__react-email-preview" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Subscription Cancelled<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
                 </div>
                
                  <body style="margin-left:auto;margin-right:auto;margin-top:auto;margin-bottom:auto;background-color:rgb(255,255,255);font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, &quot;Noto Sans&quot;, sans-serif, &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;, &quot;Segoe UI Symbol&quot;, &quot;Noto Color Emoji&quot;">
                    <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:37.5em;margin-left:auto;margin-right:auto;margin-top:40px;margin-bottom:40px;width:465px;border-radius:0.25rem;border-width:1px;border-style:solid;border-color:rgb(234,234,234);padding:20px">
                      <tr style="width:100%">
                        <td>
                          <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-top:32px">
                            <tbody>
                              <tr>
                                <td><img alt="Vercel" src="${process.env.LOGO}" width="40" height="37" style="display:block;outline:none;border:none;text-decoration:none;margin-left:auto;margin-right:auto;margin-top:0px;margin-bottom:0px" /></td>
                              </tr>
                            </tbody>
                          </table>
                          <h1 style="margin-left:0px;margin-right:0px;margin-top:30px;margin-bottom:30px;padding:0px;text-align:center;font-size:24px;font-weight:400;color:rgb(0,0,0)">Subscription Cancelled</h1>
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">${userDetails.mName}, your subscription plan has been Cancelled. Reactivate your plan by clicking on the button below.</p>
                          <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%" style="margin-bottom:32px;margin-top:32px;text-align:center">
                               <tbody>
                                  <tr>
                                    <td><a href="${Reactivate}" target="_blank" style="p-x:20px;p-y:12px;line-height:100%;text-decoration:none;display:inline-block;max-width:100%;padding:12px 20px;border-radius:0.25rem;background-color:rgb(0,0,0);text-align:center;font-size:12px;font-weight:600;color:rgb(255,255,255);text-decoration-line:none"><span></span><span style="p-x:20px;p-y:12px;max-width:100%;display:inline-block;line-height:120%;text-decoration:none;text-transform:none;mso-padding-alt:0px;mso-text-raise:9px"</span><span>Reactivate</span></a></td>
                                  </tr>
                                </tbody>
                          </table>
                          <p style="font-size:14px;line-height:24px;margin:16px 0;color:rgb(0,0,0)">Best,<p target="_blank" style="color:rgb(0,0,0);text-decoration:none;text-decoration-line:none">The <strong>${process.env.COMPANY}</strong> Team</p></p>
                          </td>
                      </tr>
                    </table>
                  </body>
                
                </html>`,
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: "" });
    });
});

//CHAT
app.post("/api/chat", async (req, res) => {
  const receivedData = req.body;

  const promptString = receivedData.prompt;

  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    safetySettings,
  });

  const prompt = promptString;

  await model
    .generateContent(prompt)
    .then((result) => {
      const response = result.response;
      const txt = response.text();
      const converter = new showdown.Converter();
      const markdownText = txt;
      const text = converter.makeHtml(markdownText);
      res.status(200).json({ text });
    })
    .catch((error) => {
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    });
});

//LISTEN
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
