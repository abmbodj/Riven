import { Shield } from 'lucide-react';
import LegalDocumentPage from '../components/legal/LegalDocumentPage.jsx';
import { privacyPolicyDocument } from '../components/legal/legalDocuments.js';

export default function PrivacyPolicy() {
    return <LegalDocumentPage document={privacyPolicyDocument} icon={Shield} />;
}
