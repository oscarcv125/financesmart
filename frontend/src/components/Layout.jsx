import { Outlet } from "react-router-dom";
import Chatbot from "./Chatbot";

export default function Layout() {
  return (
    <>
      <Outlet />
      <Chatbot />
    </>
  );
}
