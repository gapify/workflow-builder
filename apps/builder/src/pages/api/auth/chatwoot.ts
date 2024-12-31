// pages/api/custom-auth.ts

import { env } from "@typebot.io/env";
import prisma from "@typebot.io/prisma"; // or wherever your Prisma instance is
import type { User } from "@typebot.io/schemas/features/user/schema"; // if you want to decode JWT, or you can use Buffer for Base64 decoding
import { serialize } from "cookie";
import * as jose from "jose";
// pages/api/custom-auth.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function customAuthHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    // 1. Read the "auth_token" from query params
    const { auth_token } = req.query;
    if (!auth_token || typeof auth_token !== "string") {
      return res.status(400).json({ error: "Missing auth_token in query" });
    }

    // 2. Decode the base64 token to extract the raw access_token
    //    Suppose your token is base64-encoded JSON like: { "access_token": "XYZ" }
    const decodedString = Buffer.from(auth_token, "base64").toString("utf8");
    let parsedToken;

    try {
      parsedToken = JSON.parse(decodedString); // e.g. { access_token: "XYZ" }
    } catch (err) {
      return res.status(400).json({ error: "Invalid base64 token format" });
    }

    const accessToken = parsedToken["access-token"];
    if (!accessToken) {
      return res
        .status(400)
        .json({ error: "No access_token found in decoded data" });
    }

    // 3. Verify the token with your external API
    //    Replace with your actual verification endpoint
    const verificationResponse = await fetch(
      env.CHATWOOT_API_URL + "/auth/validate_token",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + auth_token,
        },
      },
    );

    if (!verificationResponse.ok) {
      return res.status(401).json({ error: "Failed to verify token" });
    }

    const verificationData = await verificationResponse.json();
    type ChatWootAccount = {
      id: string;
      name: string;
    };
    const accounts: ChatWootAccount[] = verificationData.payload.data.accounts;
    for (const account of accounts) {
      const { id, name } = account;
      const user = await prisma.user.findFirst({
        where: {
          email: "chatwoot-account-" + id + "@chatwoot.com",
        },
      });
      if (!user) {
        const new_user = await prisma.user.create({
          data: {
            name: name,
            email: "chatwoot-account-" + id + "@chatwoot.com",
            onboardingCategories: [],
          },
        });
        const new_workspace = await prisma.workspace.create({
          data: {
            name: new_user.name + "'s Workspace",
            plan: "UNLIMITED",
          },
        });
        await prisma.memberInWorkspace.create({
          data: {
            userId: new_user.id,
            workspaceId: new_workspace.id,
            role: "ADMIN",
          },
        });
      }
    }
    const existingUser = (await prisma.user.findFirst({
      where: {
        email:
          "chatwoot-account-" +
          verificationData.payload.data.account_id +
          "@chatwoot.com",
      },
    })) as User;
    const sessionToken = generateRandomString(); // create your own function
    // Upsert session in DB (example code if you have a "Session" model in Prisma)
    await prisma.session.upsert({
      where: { sessionToken: sessionToken },
      update: { sessionToken },
      create: {
        userId: existingUser.id,
        sessionToken,
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day expiration
      },
    });
    return res.status(200).json({ sessionToken, existingUser });
  } catch (error) {
    console.error("[custom-auth] error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

// Just a helper function to generate random session tokens
function generateRandomString(length = 32): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
