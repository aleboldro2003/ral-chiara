import { Calcolatore } from "@/components/Calcolatore";
import { Intestazione, PiePagina } from "@/components/Cornice";

export default function Pagina() {
  return (
    <div style={{ minHeight: "100vh", background: "#EFEBE3" }}>
      <Intestazione />
      <main>
        <Calcolatore />
      </main>
      <PiePagina />
    </div>
  );
}
