/**
 * Voice Agent (ElevenLabs)
 * 
 * AI-powered voice calls for:
 * - Confirming reservations with restaurants
 * - Requesting name transfers
 * - Checking availability
 * - Handling waitlist inquiries
 * 
 * Uses ElevenLabs Conversational AI API
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ============================================
// CONFIGURATION
// ============================================

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID || '';
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// ============================================
// TYPES
// ============================================

interface CallRequest {
  phoneNumber: string;          // Restaurant phone number
  restaurantName: string;
  objective: CallObjective;
  reservationDetails?: {
    originalName: string;
    newName: string;
    date: string;
    time: string;
    partySize: number;
    confirmationCode?: string;
  };
}

type CallObjective = 
  | 'CONFIRM_RESERVATION'    // Verify a booking exists
  | 'NAME_TRANSFER'          // Change name on reservation
  | 'CHECK_AVAILABILITY'     // Ask about openings
  | 'WAITLIST_INQUIRY'       // Check waitlist status
  | 'CANCELLATION';          // Cancel a reservation

interface CallResult {
  success: boolean;
  callId?: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'failed';
  transcript?: string;
  outcome?: string;
  error?: string;
}

interface ConversationConfig {
  agent_id: string;
  first_message: string;
  system_prompt: string;
}

// ============================================
// PROMPT TEMPLATES
// ============================================

const getSystemPrompt = (objective: CallObjective, restaurantName: string): string => {
  const basePrompt = `You are a professional personal assistant making a call on behalf of your client. 
You are polite, efficient, and clear. You speak naturally with appropriate pauses.
You are calling ${restaurantName}.`;

  switch (objective) {
    case 'CONFIRM_RESERVATION':
      return `${basePrompt}

Your objective is to confirm an existing reservation.
- Greet the host politely
- State that you're calling to confirm a reservation
- Provide the reservation details when asked
- Thank them and end the call once confirmed`;

    case 'NAME_TRANSFER':
      return `${basePrompt}

Your objective is to request a name change on an existing reservation.
- Greet the host politely
- State that you're calling about an existing reservation
- Explain that the original guest can no longer attend
- Request to change the name on the reservation
- Provide both the original and new name
- Confirm the change and thank them`;

    case 'CHECK_AVAILABILITY':
      return `${basePrompt}

Your objective is to inquire about availability.
- Greet the host politely
- Ask if they have availability for the requested date and time
- Be flexible about alternative times if offered
- If nothing available, politely ask about cancellation policies or waitlist options
- Thank them regardless of outcome`;

    case 'WAITLIST_INQUIRY':
      return `${basePrompt}

Your objective is to check on waitlist status.
- Greet the host politely
- State that you're on the waitlist
- Ask about your current position or expected wait time
- Ask if there's anything you can do to improve your chances
- Thank them for their time`;

    case 'CANCELLATION':
      return `${basePrompt}

Your objective is to cancel a reservation.
- Greet the host politely
- State that you need to cancel a reservation
- Provide the reservation details
- Apologize for any inconvenience
- Ask if there are any cancellation fees
- Confirm the cancellation and thank them`;

    default:
      return basePrompt;
  }
};

const getFirstMessage = (objective: CallObjective, restaurantName: string, details?: CallRequest['reservationDetails']): string => {
  switch (objective) {
    case 'CONFIRM_RESERVATION':
      return `Hi, this is Alex calling on behalf of a guest. I'm calling to confirm a reservation at ${restaurantName} for ${details?.date || 'this week'} at ${details?.time || 'dinner time'} under the name ${details?.originalName || 'the guest'}.`;

    case 'NAME_TRANSFER':
      return `Hi, this is Alex calling on behalf of a guest. I'm hoping you can help me with a reservation at ${restaurantName}. There's been a change of plans and I need to update the name on an existing booking.`;

    case 'CHECK_AVAILABILITY':
      return `Hi, I'm calling to check if ${restaurantName} has any availability for ${details?.partySize || 2} guests on ${details?.date || 'this weekend'}?`;

    case 'WAITLIST_INQUIRY':
      return `Hi, I'm calling to check on the status of a waitlist request at ${restaurantName}. The name on the request is ${details?.originalName || 'the guest'}.`;

    case 'CANCELLATION':
      return `Hi, I'm unfortunately calling to cancel a reservation at ${restaurantName} for ${details?.date || 'the upcoming date'} under the name ${details?.originalName || 'the guest'}.`;

    default:
      return `Hi, I'm calling about a reservation at ${restaurantName}.`;
  }
};

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Initiate an outbound call via ElevenLabs
 */
export const initiateCall = async (request: CallRequest): Promise<CallResult> => {
  if (!ELEVENLABS_API_KEY) {
    return { 
      success: false, 
      status: 'failed',
      error: 'ElevenLabs API key not configured' 
    };
  }

  if (!ELEVENLABS_AGENT_ID) {
    return { 
      success: false, 
      status: 'failed',
      error: 'ElevenLabs Agent ID not configured' 
    };
  }

  console.log(`[VoiceAgent] Initiating ${request.objective} call to ${request.restaurantName}`);
  console.log(`[VoiceAgent] Phone: ${request.phoneNumber}`);

  try {
    // Prepare conversation configuration
    const config: ConversationConfig = {
      agent_id: ELEVENLABS_AGENT_ID,
      first_message: getFirstMessage(request.objective, request.restaurantName, request.reservationDetails),
      system_prompt: getSystemPrompt(request.objective, request.restaurantName)
    };

    // Make API call to ElevenLabs
    // Note: The exact endpoint and payload structure depends on ElevenLabs' current API
    // This is a template that may need adjustment based on their documentation
    const response = await fetch(`${ELEVENLABS_API_URL}/convai/conversation/create-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        agent_id: config.agent_id,
        phone_number: request.phoneNumber,
        first_message: config.first_message,
        system_prompt: config.system_prompt,
        metadata: {
          restaurant: request.restaurantName,
          objective: request.objective,
          ...request.reservationDetails
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[VoiceAgent] API Error: ${response.status} - ${errorText}`);
      return {
        success: false,
        status: 'failed',
        error: `API Error: ${response.status}`
      };
    }

    const data = await response.json();
    console.log(`[VoiceAgent] Call initiated: ${data.call_id || data.conversation_id}`);

    return {
      success: true,
      callId: data.call_id || data.conversation_id,
      status: 'initiated'
    };

  } catch (error: any) {
    console.error('[VoiceAgent] Failed to initiate call:', error.message);
    return {
      success: false,
      status: 'failed',
      error: error.message
    };
  }
};

/**
 * Check the status of an ongoing or completed call
 */
export const getCallStatus = async (callId: string): Promise<CallResult> => {
  if (!ELEVENLABS_API_KEY) {
    return { 
      success: false, 
      status: 'failed',
      error: 'ElevenLabs API key not configured' 
    };
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/convai/conversation/${callId}`, {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });

    if (!response.ok) {
      return {
        success: false,
        status: 'failed',
        error: `API Error: ${response.status}`
      };
    }

    const data = await response.json();

    return {
      success: true,
      callId,
      status: data.status || 'completed',
      transcript: data.transcript,
      outcome: data.outcome || data.summary
    };

  } catch (error: any) {
    return {
      success: false,
      status: 'failed',
      error: error.message
    };
  }
};

// ============================================
// HIGH-LEVEL FUNCTIONS
// ============================================

/**
 * Confirm a reservation via phone call
 */
export const confirmReservation = async (
  phoneNumber: string,
  restaurantName: string,
  guestName: string,
  date: string,
  time: string,
  partySize: number,
  confirmationCode?: string
): Promise<CallResult> => {
  return initiateCall({
    phoneNumber,
    restaurantName,
    objective: 'CONFIRM_RESERVATION',
    reservationDetails: {
      originalName: guestName,
      newName: guestName,
      date,
      time,
      partySize,
      confirmationCode
    }
  });
};

/**
 * Request a name transfer on a reservation
 */
export const transferName = async (
  phoneNumber: string,
  restaurantName: string,
  originalName: string,
  newName: string,
  date: string,
  time: string,
  partySize: number,
  confirmationCode?: string
): Promise<CallResult> => {
  return initiateCall({
    phoneNumber,
    restaurantName,
    objective: 'NAME_TRANSFER',
    reservationDetails: {
      originalName,
      newName,
      date,
      time,
      partySize,
      confirmationCode
    }
  });
};

/**
 * Check availability at a restaurant
 */
export const checkAvailability = async (
  phoneNumber: string,
  restaurantName: string,
  date: string,
  time: string,
  partySize: number
): Promise<CallResult> => {
  return initiateCall({
    phoneNumber,
    restaurantName,
    objective: 'CHECK_AVAILABILITY',
    reservationDetails: {
      originalName: '',
      newName: '',
      date,
      time,
      partySize
    }
  });
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if voice agent is configured
 */
export const isConfigured = (): boolean => {
  return !!(ELEVENLABS_API_KEY && ELEVENLABS_AGENT_ID);
};

/**
 * Get configuration status
 */
export const getConfigStatus = (): { 
  apiKey: boolean; 
  agentId: boolean;
  ready: boolean;
} => {
  return {
    apiKey: !!ELEVENLABS_API_KEY,
    agentId: !!ELEVENLABS_AGENT_ID,
    ready: isConfigured()
  };
};

export default {
  initiateCall,
  getCallStatus,
  confirmReservation,
  transferName,
  checkAvailability,
  isConfigured,
  getConfigStatus
};


