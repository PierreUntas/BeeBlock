"use client"

const sectors = [
  {
    label: 'Peinture',
    category: 'Painting',
    svg: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M576 320C576 320.9 576 321.8 576 322.7C575.6 359.2 542.4 384 505.9 384L408 384C381.5 384 360 405.5 360 432C360 435.4 360.4 438.7 361 441.9C363.1 452.1 367.5 461.9 371.8 471.8C377.9 485.6 383.9 499.3 383.9 513.8C383.9 545.6 362.3 574.5 330.5 575.8C327 575.9 323.5 576 319.9 576C178.5 576 63.9 461.4 63.9 320C63.9 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320zM192 352C192 334.3 177.7 320 160 320C142.3 320 128 334.3 128 352C128 369.7 142.3 384 160 384C177.7 384 192 369.7 192 352zM192 256C209.7 256 224 241.7 224 224C224 206.3 209.7 192 192 192C174.3 192 160 206.3 160 224C160 241.7 174.3 256 192 256zM352 160C352 142.3 337.7 128 320 128C302.3 128 288 142.3 288 160C288 177.7 302.3 192 320 192C337.7 192 352 177.7 352 160zM448 256C465.7 256 480 241.7 480 224C480 206.3 465.7 192 448 192C430.3 192 416 206.3 416 224C416 241.7 430.3 256 448 256z" /></svg>
  },
  {
    label: 'Dessin',
    category: 'Drawing',
    svg: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z" /></svg>
  },
  {
    label: 'Sculpture',
    category: 'Sculpture',
    svg: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M234.5 5.7c13.9-5 29.1-5 43.1 0l192 68.6C495 83.4 512 107.5 512 134.6V377.4c0 27-17 51.2-42.5 60.3l-192 68.6c-13.9 5-29.1 5-43.1 0l-192-68.6C17 428.6 0 404.5 0 377.4V134.6c0-27 17-51.2 42.5-60.3l192-68.6zM256 66L82.3 128 256 190l173.7-62L256 66zm32 368.6l160-57.1v-188L288 246.6v188z" /></svg>
  },
  {
    label: 'Photographie',
    category: 'Photography',
    svg: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M149.1 64.8L138.7 96H64C28.7 96 0 124.7 0 160V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H373.3L362.9 64.8C356.4 45.2 338.1 32 317.4 32H194.6c-20.7 0-39 13.2-45.5 32.8zM256 192a96 96 0 1 1 0 192 96 96 0 1 1 0-192z" /></svg>
  },
  {
    label: 'Art numérique',
    category: 'Digital Art',
    svg: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M64 0C28.7 0 0 28.7 0 64V352c0 35.3 28.7 64 64 64H240l-10.7 32H160c-17.7 0-32 14.3-32 32s14.3 32 32 32H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H346.7L336 416H512c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64H64zM512 64V288H64V64H512z" /></svg>
  },
  {
    label: 'Gravure',
    category: 'Print',
    svg: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M160 96C160 78.3 145.7 64 128 64S96 78.3 96 96V416c0 17.7 14.3 32 32 32s32-14.3 32-32V96zM256 96c0-17.7-14.3-32-32-32s-32 14.3-32 32V416c0 17.7 14.3 32 32 32s32-14.3 32-32V96zM192 416V96c0-17.7-14.3-32-32-32s-32 14.3-32 32V416c0 17.7 14.3 32 32 32s32-14.3 32-32zm160-64c0-17.7-14.3-32-32-32s-32 14.3-32 32v64c0 17.7 14.3 32 32 32s32-14.3 32-32V352zm64 64c0 17.7 14.3 32 32 32s32-14.3 32-32V96c0-17.7-14.3-32-32-32s-32 14.3-32 32V416z" /></svg>
  },
  {
    label: 'Textile',
    category: 'Textile',
    svg: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M96 0C43 0 0 43 0 96V416c0 53 43 96 96 96H384h32c17.7 0 32-14.3 32-32s-14.3-32-32-32V384c17.7 0 32-14.3 32-32V32c0-17.7-14.3-32-32-32H384 96zm0 384H352v64H96c-17.7 0-32-14.3-32-32s14.3-32 32-32zm32-240c0-8.8 7.2-16 16-16H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16zm16 48H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16s7.2-16 16-16z" /></svg>
  },
  {
    label: 'Céramique',
    category: 'Ceramics',
    svg: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" fill="currentColor"><path d="M253.5 51.7C248.6 39.8 236.9 32 224 32c-2.7 0-5.4 .3-8.1 .9L96.2 57.8c-10.5 2.4-18.5 10.8-20.2 21.5l-4.1 25.7L28.5 169.5c-8.5 12.8-13.1 28.2-12.7 43.8L18.3 440c.6 24.4 20.3 44 44.7 44H257c24.4 0 44.1-19.6 44.7-44l2.5-226.6c.5-15.6-4.1-31-12.7-43.8L248.1 105l-4.1-25.7c-.8-5.1-1-10.3-.6-15.6z" /></svg>
  },
  {
    label: 'Techniques mixtes',
    category: 'Mixed Media',
    svg: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M315.4 15.5C309.7 5.9 299.2 0 288 0s-21.7 5.9-27.4 15.5l-96 160c-5.9 9.9-6.1 22.2-.4 32.2s16.3 16.2 27.8 16.2H384c11.5 0 22.2-6.2 27.8-16.2s5.5-22.3-.4-32.2l-96-160zM288 312V456c0 22.1 17.9 40 40 40H472c22.1 0 40-17.9 40-40V312c0-22.1-17.9-40-40-40H328c-22.1 0-40 17.9-40 40zM128 512a128 128 0 1 0 0-256 128 128 0 1 0 0 256z" /></svg>
  },
  {
    label: 'Installation',
    category: 'Installation',
    svg: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M243.4 2.6l-224 96c-14 6-21.8 21-18.7 35.8S16.8 160 32 160v8c0 13.3 10.7 24 24 24H456c13.3 0 24-10.7 24-24v-8c15.2 0 28.3-10.7 31.3-25.6s-4.8-29.9-18.7-35.8l-224-96c-8-3.4-17.2-3.4-25.2 0zM128 224H64V420.3c-.6 .3-1.2 .7-1.8 1.1l-48 32c-11.7 7.8-17 22.4-12.9 35.9S17.9 512 32 512H480c14.1 0 26.5-9.2 30.6-22.7s-1.1-28.1-12.9-35.9l-48-32c-.6-.4-1.2-.7-1.8-1.1V224H384V416H344V224H280V416H232V224H168V416H128V224zm128-96c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32z" /></svg>
  },
  {
    label: 'Vidéo',
    category: 'Video',
    svg: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M0 128C0 92.7 28.7 64 64 64H320c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128zM559.1 99.8c10.4 5.6 16.9 16.4 16.9 28.2V384c0 11.8-6.5 22.6-16.9 28.2s-23 5-32.9-1.6l-96-64L416 337.1V320 192 174.9l14.2-9.5 96-64c9.8-6.5 22.4-7.2 32.9-1.6z" /></svg>
  },
  {
    label: 'Autre',
    category: 'Other',
    svg: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M8 256a56 56 0 1 1 112 0A56 56 0 1 1 8 256zm160 0a56 56 0 1 1 112 0 56 56 0 1 1 -112 0zm216-56a56 56 0 1 1 0 112 56 56 0 1 1 0-112z" /></svg>
  },
];

const techs = [
  { name: 'Ethereum', url: 'https://ethereum.org' },
  { name: 'Solidity', url: 'https://soliditylang.org' },
  { name: 'IPFS', url: 'https://ipfs.tech' },
  { name: 'Merkle Tree', url: 'https://en.wikipedia.org/wiki/Merkle_tree' },
  { name: 'ERC-1155', url: 'https://eips.ethereum.org/EIPS/eip-1155' },
  { name: 'Next.js', url: 'https://nextjs.org' },
  { name: 'Privy', url: 'https://privy.io' },
  { name: 'Wagmi', url: 'https://wagmi.sh' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#f5f3ef] text-[#1c1917]">
      <div className="max-w-[860px] mx-auto px-6 pt-28 pb-20">

        {/* Header */}
        <div className="text-center mb-[72px]">
          <div className="text-[11px] font-normal tracking-[0.18em] uppercase text-[#a8a29e] mb-5 flex items-center justify-center gap-3">
            <span className="block w-8 h-px bg-[#d6d0c8]" />
            À propos
            <span className="block w-8 h-px bg-[#d6d0c8]" />
          </div>
          <h1 className=" text-[clamp(40px,6vw,64px)] font-normal tracking-[-1.5px] leading-[1.1] mb-5">
            Transférer la propriété<br />
            <em className="italic text-[#78716c]">de Vos Oeuvres.</em>
          </h1>
          <p className="text-[15px] font-light leading-[1.8] text-[#78716c] max-w-[480px] mx-auto">
            Mona Editions est une plateforme qui permet aux artistes de certifier leurs œuvres, de les exposer et de transférer la propriété de manière sûre et transparente, grâce à la blockchain.
          </p>
        </div>

        {/* Main card */}
        <div className="border border-[#d6d0c8] bg-[#fafaf8] mb-px p-10">
          <h2 className=" text-[22px] font-normal mb-5">
            <em className="italic text-[#78716c]">La Blockchain </em>au service de l’art et de la propriété.
          </h2>
          <div className="text-[14px] font-light leading-[1.85] text-[#78716c]">
            <p>
              L’application repose sur des smart contracts dont le propriétaire peut ajouter des administrateurs. Ces derniers disposent ensuite du pouvoir d’autoriser de nouveaux artistes à utiliser la plateforme, ce qui permet de structurer et de maîtriser l’écosystème.

              Un artiste peut enregistrer ses données professionnelles sur la blockchain et créer des certificats pour ses œuvres d’art.

              De son côté un visiteur peut consulter les différents artistes et œuvres certifiées.

              Un collectionneur peut réclamer un certificat et consulter les œuvres qu’il possède.

              L’accent a été mis sur la simplicité d’utilisation : inscription et connexion fluides, transfert de certificats intuitifs, interface pensée pour les artistes et les amateurs d’art.

              Les smart contracts ont été déployés sur un Layer 2 pour garantir une utilisation économique, tout en respectant un niveau de sécurité rigoureux. Le design de l’application est pensé pour s’aligner avec l’identité du projet, en restant minimal et centré sur l’œuvre.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 my-8">
          <span className="flex-1 h-px bg-[#d6d0c8]" />
          <span className=" italic text-[13px] text-[#a8a29e]">·</span>
          <span className="flex-1 h-px bg-[#d6d0c8]" />
        </div>

        {/* Manifeste */}
        <div className="border border-[#d6d0c8] bg-[#1c1917] p-10 mb-8">
          <div className="text-[10px] font-normal tracking-[0.15em] uppercase text-white/30 mb-4">
            Mona Editions
          </div>
          <div className=" text-[clamp(20px,3vw,28px)] font-normal text-white leading-[1.4]">
            Permettre aux artistes de <em className="italic text-white/40">certifier leurs œuvres</em>, de les exposer et d’en transférer la propriété de manière simple, sécurisée et économique grâce à la blockchain.<br />
          </div>
        </div>  

        {/* Sectors */}
        <div className="border border-[#d6d0c8] bg-[#fafaf8] p-10 mb-8">
          <h3 className=" text-[17px] font-normal mb-5 text-[#1c1917]">
            Disciplines couvertes
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {sectors.map(({ svg, label, category }) => (
              <a
                key={label}
                href={`/explore/editions?category=${encodeURIComponent(category)}`}
                className="flex items-center gap-2.5 py-2.5 px-3 border border-[#d6d0c8] bg-[#f5f3ef] hover:bg-[#e7e3dc] hover:border-[#1c1917] transition-all duration-200 no-underline group"
              >
                <div className="w-4 h-4 text-[#78716c] group-hover:text-[#1c1917] flex-shrink-0 transition-colors">
                  {svg}
                </div>
                <span className="text-[12px] font-light text-[#78716c] group-hover:text-[#1c1917] transition-colors">{label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Tech */}
        <div className="border border-[#d6d0c8] bg-[#ede9e3] p-10 mb-10">
          <h3 className=" text-[17px] font-normal mb-1.5 text-[#1c1917]">
            Technologie
          </h3>
          <p className="text-[13px] font-light text-[#78716c] mb-5 leading-[1.7]">
            Mona Editions est construit sur des standards ouverts et des technologies éprouvées.
          </p>
          <div className="flex flex-wrap gap-2">
            {techs.map(({ name, url }) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-normal tracking-[0.06em] text-[#78716c] border border-[#d6d0c8] py-1 px-3 font-mono bg-[#fafaf8] hover:border-[#1c1917] hover:text-[#1c1917] transition-all duration-200 no-underline"
              >
                {name}
              </a>
            ))}
          </div>
        </div>

        {/* Back */}
        <div className="text-center">
          <a
            href="/"
            className="text-[12px] font-normal tracking-[0.06em] text-[#78716c] no-underline border border-[#d6d0c8] py-3 px-7 inline-block transition-all duration-200 hover:border-[#1c1917] hover:text-[#1c1917]"
          >
            ← Retour à l'accueil
          </a>
        </div>

      </div>
    </div>
  );
}