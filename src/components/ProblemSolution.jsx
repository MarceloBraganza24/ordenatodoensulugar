export function ProblemSolution() {
  return (
    <section className="problemSolutionContainer">
      <div className="problemSolutionContainer__problem">
        <h2 className="problemSolutionContainer__problem__title">El problema</h2>
        <ul className="problemSolutionContainer__problem__ul">
          <li>Envases desordenados</li>
          <li>Se pierde espacio</li>
        </ul>
      </div>

      <div className="problemSolutionContainer__solution">
        <h2 className="problemSolutionContainer__problem__title">La solución</h2>
        <ul className="problemSolutionContainer__problem__ul">
          <li>Todo visible</li>
          <li>Hermético + fácil limpieza</li>
          <li>Apilables</li>
        </ul>
      </div>
    </section>
  );
}
