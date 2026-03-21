import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { handleAcceptSharedResourceRequest } from '../_shared/acceptSharedResourceHandler.ts';

serve(handleAcceptSharedResourceRequest);
