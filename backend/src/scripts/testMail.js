import { sendEmail } from "../utils/mailer.js";

const run = async () => {
  console.log("Starting SMTP test inside backend...");
  try {
    await sendEmail({
      to: "prashant.llm.00@gmail.com",
      subject: "SnapURL SMTP Test Code",
      text: "If you receive this, the Nodemailer SMTP setup works correctly!",
    });
    console.log("SMTP Test Completed successfully!");
  } catch (error) {
    console.error("SMTP Test Failed with error:", error);
  }
};

run();
