import { ScrollText } from 'lucide-react';
import LegalDocumentPage from '../components/legal/LegalDocumentPage.jsx';
import { termsOfServiceDocument } from '../components/legal/legalDocuments.js';

export default function TermsOfService() {
    return <LegalDocumentPage document={termsOfServiceDocument} icon={ScrollText} />;
}
