import LegalPage from '@/components/shared/LegalPage';

export const metadata = {
    title: 'Mentions légales — Mona Editions',
    description:
        "Mentions légales du site Mona Editions, plateforme de certification d'œuvres d'art sur blockchain Base.",
};

export default function MentionsLegalesPage() {
    return <LegalPage file="mentions.md" title="Mentions" accent="légales" />;
}
