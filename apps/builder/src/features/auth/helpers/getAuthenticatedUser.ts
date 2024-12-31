import * as Sentry from "@sentry/nextjs";
import { env } from "@typebot.io/env";
import { mockedUser } from "@typebot.io/lib/mockedUser";
import prisma from "@typebot.io/prisma";
import type { Prisma } from "@typebot.io/prisma/types";
import type { NextApiRequest, NextApiResponse } from "next";

export const getAuthenticatedUser = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<Prisma.User | undefined> => {
  const bearerToken = extractBearerToken(req);
  const session = req.cookies['typebot_session'];
  const sessionObj = await prisma.session.findFirst({
    where: {
      sessionToken: session
    }
  })
  console.log('SESSION:', session);
  if (!sessionObj) return;
  const user = await prisma.user.findFirst({
    where: {
      id: sessionObj?.userId
    }
  })
  console.log('USERRRR:', user);
  if (bearerToken) return authenticateByToken(bearerToken);
  if (!user || !("id" in user)) return;
  Sentry.setUser({ id: user.id });
  return user;
};

const authenticateByToken = async (
  apiToken: string,
): Promise<Prisma.User | undefined> => {
  if (typeof window !== "undefined") return;
  const user = (await prisma.user.findFirst({
    where: { apiTokens: { some: { token: apiToken } } },
  })) as Prisma.User;
  Sentry.setUser({ id: user.id });
  return user;
};

const extractBearerToken = (req: NextApiRequest) =>
  req.headers["authorization"]?.slice(7);
