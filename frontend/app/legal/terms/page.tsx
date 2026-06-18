import LegalPage from '@/components/shared/LegalPage';

export const metadata = {
    title: "Conditions Générales d'Abonnement — Mona Editions",
    description:
        "Conditions générales applicables à l'abonnement Atelier de la plateforme Mona Editions.",
};

export default function ConditionsAbonnementPage() {
    return <LegalPage file="terms.md" title="Conditions" accent="d'abonnement" />;
}
