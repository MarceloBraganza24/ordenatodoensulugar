import {LegalSections} from "@/components/AccordionItem";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <>
      <LegalSections/>
      <footer className="footerContainer">
        <nav className="footerContainer__items">
          <a className="footerContainer__items__item" href="#quienes">Quiénes somos</a>{" "}
          <a className="footerContainer__items__item" href="#contacto">Contacto</a>{" "}
          <a className="footerContainer__items__item" href="#tyc">Términos y condiciones</a>{" "}
          <a className="footerContainer__items__item" href="#privacidad">Política de privacidad</a>{" "}
          <a className="footerContainer__items__item" href="#cambios">Cambios y devoluciones</a>{" "}
          <a className="footerContainer__items__item" href="#arrepentimiento">Botón de arrepentimiento</a>
        </nav>

        <p className="footerContainer__copy">© {year} ORDENA - Todo en su lugar. Todos los derechos reservados.</p>
      </footer>
    </>
  );
}
