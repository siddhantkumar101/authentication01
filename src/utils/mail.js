import nodemailer from "nodemailer";

export const sendEmail = async (email, subject, text) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail', // Ya koi aur service (SendGrid, Mailtrap)
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS, 
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: subject,
            text: text,
        };

        await transporter.sendMail(mailOptions);
        console.log("Email sent successfully");
    } catch (error) {
        console.log("Email error: ", error);
        // Error throw karne ki zaroorat nahi hai, bas log karein
    }
};