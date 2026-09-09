import { useLocation } from "react-router-dom";
export default function Soon() {
  const name = useLocation().pathname.split("/").pop().replace("-", " ");
  return (
    <>
      <div className="pagehead"><div><h1 style={{ textTransform: "capitalize" }}>{name}</h1><p>Comes in a later slice. The data it needs is already in the database.</p></div></div>
    </>
  );
}
