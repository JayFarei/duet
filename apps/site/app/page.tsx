import { cookies } from "next/headers";
import { Home } from "./home";

// The duet-duo cookie (kept by <DuoCookie>) lets the server send the Duo layout from the first byte.
export default async function Page() {
  const duo = (await cookies()).get("duet-duo")?.value === "1";
  return <Home duo={duo} />;
}
