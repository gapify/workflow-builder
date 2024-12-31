// pages/index.tsx
import type { GetServerSidePropsContext } from "next";
import { parseCookies } from "nookies";
import {serialize} from "cookie";

export default function Page() {
  // This page doesn't render anything because we redirect immediately on server-side
  return null;
}

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const { auth_token } = context.query;
  console.log(auth_token);
  if (auth_token) {
    // Optionally, we could call our API route internally or just replicate the logic here
    // For simplicity, let's just do an internal fetch
    const customAuthUrl = `${process.env.NEXTAUTH_URL}/api/auth/chatwoot?auth_token=${auth_token}`

    const authResponse = await fetch(customAuthUrl)
    // That will set the cookie in the "res" automatically if Next.js proxy passes it down
    // Or you might need to replicate logic to manually set cookies.
    // replicate logic to manually set cookies.
    const sessionTokenData = await authResponse.json(); // Assuming the response contains the session token
    console.log('sessionTokenData', sessionTokenData);
    const session = serialize('typebot_session', sessionTokenData.sessionToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
      sameSite: 'lax',
    });
    const existingUser = serialize('typebot_user', JSON.stringify(sessionTokenData.existingUser), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
      sameSite: 'lax',
    });
    context.res.setHeader('Set-Cookie', [session, existingUser]);
  }
  return {
    redirect: {
      permanent: false,
      destination:
        context.locale !== context.defaultLocale
          ? `/${context.locale}/typebots`
          : "/typebots",
    },
  };
};
