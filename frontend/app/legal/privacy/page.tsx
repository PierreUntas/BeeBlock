import LegalPage from '@/components/shared/LegalPage';

export const metadata = {
    title: 'Politique de confidentialité — Mona Editions',
    description:
        "Comment Mona Editions collecte, utilise et protège vos données personnelles. Politique conforme RGPD.",
};

export default function PolitiqueConfidentialitePage() {
    return <LegalPage file="privacy.md" title="Politique de" accent="confidentialité" />;
}
