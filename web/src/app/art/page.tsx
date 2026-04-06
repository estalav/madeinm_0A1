import Image from "next/image";

export const metadata = {
  title: "Art | Estala",
  description: "A minimalist preview of the Art from Estala project.",
};

export default function ArtPage() {
  return (
    <main className="art-shell">
      <section className="art-hero">
        <div className="art-copy">
          <p className="estala-kicker">Art from Estala</p>
          <h1>Photography, visual studies, and slower image-driven work.</h1>
          <p>
            This is an initial placeholder for the art side of Estala. The direction is calm,
            minimal, and highly visual, with room for series, prints, and short project notes.
          </p>
        </div>

        <div className="art-media">
          <Image
            src="/estala/jellyfish.jpeg"
            alt="Jellyfish photograph used for the Art from Estala mockup."
            fill
            priority
            sizes="(max-width: 960px) 100vw, 42vw"
            className="art-image"
          />
        </div>
      </section>

      <section className="art-grid">
        <article>
          <span>Series</span>
          <h2>Water, skyline, movement</h2>
          <p>
            The early visual language can move between marine life, city geometry, and bright
            California light without becoming cluttered.
          </p>
        </article>
        <article>
          <span>Format</span>
          <h2>Minimal by default</h2>
          <p>
            Large images, restrained text, and generous spacing feel closer to the Apple-style
            simplicity you described than a busy portfolio grid.
          </p>
        </article>
      </section>
    </main>
  );
}
