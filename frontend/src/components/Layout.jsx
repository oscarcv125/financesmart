import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Chatbot from "./Chatbot";


export default function Layout() {
  return (
    <>
      <Sidebar />
      <main style={{ marginLeft: "200px", marginTop: "63px", padding: "24px" }}>
        <Outlet />
      </main>
      <Chatbot />
    </>
  );
}