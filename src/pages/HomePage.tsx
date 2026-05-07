import { Link } from "react-router-dom";
import "../styles/homepage.css";

export default function HomePage() {
  return (
    <div className="landingPage">
      <div className="landingBackdrop" />

      <header className="landingHeader">
        <div className="landingBrand">MinutoFit</div>
        <nav className="landingActions">
          <Link to="/login" className="landingButton ghost">
            Entrar
          </Link>
          <Link to="/register" className="landingButton primary">
            Criar conta grátis
          </Link>
        </nav>
      </header>

      <main className="landingMain">
        <section className="heroBlock">
          <p className="heroKicker">Metabolismo como Serviço</p>
          <h1>
            Treine com
            <span> inteligência metabólica</span>
          </h1>
          <p className="heroText">
            Score metabólico em tempo real, acompanhamento personalizado e análise de movimento — tudo integrado na sua rotina.
          </p>
          <div className="heroCtas">
            <Link to="/register" className="landingButton primary">
              Criar minha conta
            </Link>
            <Link to="/login" className="landingButton ghost">
              Já tenho conta
            </Link>
          </div>
        </section>

        <section className="runwayBlock" aria-label="Animacao de largada">
          <div className="laneGlow" />
          <div className="laneStripe s1" />
          <div className="laneStripe s2" />
          <div className="laneStripe s3" />

          <div className="runner" aria-hidden="true">
            <div className="runnerHead">
              <div className="runnerHair" />
            </div>
            <div className="runnerTorso" />
            <div className="runnerArm armBack" />
            <div className="runnerArm armFront" />
            <div className="runnerLeg legBack" />
            <div className="runnerLeg legFront" />
            <div className="runnerFoot footBack" />
            <div className="runnerFoot footFront" />
            <div className="flame flameBack">
              <span />
            </div>
            <div className="flame flameFront">
              <span />
            </div>
            <div className="speedTrail t1" />
            <div className="speedTrail t2" />
            <div className="speedTrail t3" />
          </div>

          <div className="runCaption">
            Simulacao visual de arrancada: postura inclinada, impulso forte e chama simbolizando explosao inicial.
          </div>
        </section>
      </main>
    </div>
  );
}
