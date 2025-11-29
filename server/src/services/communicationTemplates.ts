/**
 * Communication Templates Service
 * 
 * Auto-generates messages for:
 * - Buyer transfer instructions
 * - AT listing descriptions
 * - Confirmation emails
 * - Follow-up messages
 */

interface TransferDetails {
  restaurantName: string;
  reservationDate: string;
  reservationTime: string;
  partySize: number;
  platform: string;
  confirmationNumber?: string;
  buyerName: string;
  originalName: string;
  transferMethod: 'NAME_CHANGE' | 'CANCEL_REBOOK' | 'PLATFORM_TRANSFER' | 'SHOW_UP_TOGETHER';
}

interface ListingDetails {
  restaurantName: string;
  reservationDate: string;
  reservationTime: string;
  partySize: number;
  platform: string;
  price: number;
  highlights?: string[];
}

class CommunicationTemplates {
  
  /**
   * Generate transfer instructions for buyer
   */
  getTransferInstructions(details: TransferDetails): string {
    const { restaurantName, reservationDate, reservationTime, partySize, platform, 
            confirmationNumber, buyerName, originalName, transferMethod } = details;
    
    const formattedDate = new Date(reservationDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    const formattedTime = this.formatTime(reservationTime);
    
    let instructions = `🎉 **RESERVATION TRANSFER CONFIRMATION**\n\n`;
    instructions += `Restaurant: ${restaurantName}\n`;
    instructions += `Date: ${formattedDate}\n`;
    instructions += `Time: ${formattedTime}\n`;
    instructions += `Party Size: ${partySize} guests\n`;
    instructions += `Platform: ${platform}\n`;
    if (confirmationNumber) {
      instructions += `Confirmation #: ${confirmationNumber}\n`;
    }
    instructions += `\n---\n\n`;
    
    switch (transferMethod) {
      case 'NAME_CHANGE':
        instructions += `**Transfer Method: Name Change**\n\n`;
        instructions += `I will change the reservation name from "${originalName}" to "${buyerName}".\n\n`;
        instructions += `**What you need to do:**\n`;
        instructions += `1. Wait for my confirmation that the name has been changed\n`;
        instructions += `2. Arrive at the restaurant at ${formattedTime}\n`;
        instructions += `3. Check in under your name: "${buyerName}"\n`;
        instructions += `4. Show ID if requested\n\n`;
        instructions += `**Timeline:**\n`;
        instructions += `- I will process the name change within 24 hours\n`;
        instructions += `- You'll receive confirmation once complete\n`;
        break;
        
      case 'CANCEL_REBOOK':
        instructions += `**Transfer Method: Cancel & Rebook**\n\n`;
        instructions += `I will cancel my reservation and immediately rebook under your name.\n\n`;
        instructions += `**IMPORTANT: I need your booking credentials:**\n`;
        instructions += `- Your ${platform} email: [PLEASE PROVIDE]\n`;
        instructions += `- Your ${platform} password: [PLEASE PROVIDE]\n\n`;
        instructions += `**Process:**\n`;
        instructions += `1. I will coordinate the timing with you\n`;
        instructions += `2. Cancel my reservation\n`;
        instructions += `3. Immediately book under your account\n`;
        instructions += `4. Confirm completion\n\n`;
        instructions += `⚠️ **Risk Note:** There's a small window where the slot could be taken. I'll minimize this risk.\n`;
        break;
        
      case 'PLATFORM_TRANSFER':
        instructions += `**Transfer Method: Platform Transfer**\n\n`;
        instructions += `${platform} supports direct reservation transfers!\n\n`;
        instructions += `**What you need to do:**\n`;
        instructions += `1. You'll receive a transfer request from ${platform}\n`;
        instructions += `2. Accept the transfer in your ${platform} account\n`;
        instructions += `3. The reservation will appear in your upcoming reservations\n\n`;
        instructions += `**What I need from you:**\n`;
        instructions += `- Your ${platform} email address\n`;
        break;
        
      case 'SHOW_UP_TOGETHER':
        instructions += `**Transfer Method: Meet at Restaurant**\n\n`;
        instructions += `I will meet you at the restaurant and check you in.\n\n`;
        instructions += `**What you need to do:**\n`;
        instructions += `1. Meet me at ${restaurantName} at ${formattedTime}\n`;
        instructions += `2. I'll check in and hand off the table to you\n`;
        instructions += `3. Enjoy your meal!\n\n`;
        instructions += `**Meeting details:**\n`;
        instructions += `- Location: Restaurant entrance\n`;
        instructions += `- Time: ${formattedTime} (be on time!)\n`;
        instructions += `- I'll be wearing: [TO BE CONFIRMED]\n\n`;
        instructions += `💡 **Tip:** This is common and restaurants usually don't mind.\n`;
        break;
    }
    
    instructions += `\n---\n\n`;
    instructions += `**Questions?** Message me anytime. Enjoy your meal! 🍽️`;
    
    return instructions;
  }
  
  /**
   * Generate AT listing description
   */
  getATListingDescription(details: ListingDetails): string {
    const { restaurantName, reservationDate, reservationTime, partySize, platform, price, highlights } = details;
    
    const formattedDate = new Date(reservationDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    
    const formattedTime = this.formatTime(reservationTime);
    
    let description = `🔥 **${restaurantName}** 🔥\n\n`;
    description += `📅 ${formattedDate}\n`;
    description += `⏰ ${formattedTime}\n`;
    description += `👥 Party of ${partySize}\n`;
    description += `📱 Platform: ${platform}\n\n`;
    
    if (highlights && highlights.length > 0) {
      description += `✨ **Why this reservation is special:**\n`;
      highlights.forEach(h => {
        description += `• ${h}\n`;
      });
      description += `\n`;
    }
    
    description += `💰 **Asking Price: $${price}**\n\n`;
    description += `✅ Confirmed reservation\n`;
    description += `✅ Fast transfer (name change or rebook)\n`;
    description += `✅ 100% success rate\n\n`;
    description += `📩 DM for details or to make an offer!\n`;
    description += `⚡ Serious inquiries only - First come, first served!`;
    
    return description;
  }
  
  /**
   * Generate confirmation message after sale
   */
  getSaleConfirmationMessage(details: {
    buyerName: string;
    restaurantName: string;
    price: number;
    paymentMethod: string;
  }): string {
    return `🎉 **SALE CONFIRMED!**

Thank you, ${details.buyerName}!

**Purchase Details:**
- Restaurant: ${details.restaurantName}
- Amount Paid: $${details.price}
- Payment: ${details.paymentMethod}

**Next Steps:**
1. I'll send you transfer instructions shortly
2. Please provide any required information when asked
3. Transfer will be completed within 24-48 hours

Questions? Just message me!`;
  }
  
  /**
   * Generate follow-up message (for unsold listings)
   */
  getFollowUpMessage(details: {
    restaurantName: string;
    daysUntilReservation: number;
    currentPrice: number;
    newPrice?: number;
  }): string {
    const { restaurantName, daysUntilReservation, currentPrice, newPrice } = details;
    
    if (newPrice && newPrice < currentPrice) {
      return `⬇️ **PRICE DROP ALERT!**

${restaurantName} reservation - now $${newPrice} (was $${currentPrice})!

Only ${daysUntilReservation} days until the reservation date.

Don't miss this opportunity! DM to claim it now.`;
    }
    
    return `⏰ **REMINDER**

${restaurantName} reservation still available!

Current price: $${currentPrice}
Days until reservation: ${daysUntilReservation}

Interested? DM me to secure it!`;
  }
  
  /**
   * Generate pre-drop reminder message
   */
  getDropReminderMessage(details: {
    restaurantName: string;
    dropTime: string;
    dropDate: string;
    targetDate: string;
    platform: string;
  }): string {
    const { restaurantName, dropTime, dropDate, targetDate, platform } = details;
    
    return `⚡ **DROP ALERT**

${restaurantName} reservations drop in 5 minutes!

📅 Drop Date: ${dropDate}
⏰ Drop Time: ${dropTime}
🎯 Target: ${targetDate}
📱 Platform: ${platform}

Bot is armed and ready! 🤖`;
  }
  
  /**
   * Generate acquisition success notification
   */
  getAcquisitionSuccessMessage(details: {
    restaurantName: string;
    date: string;
    time: string;
    partySize: number;
    platform: string;
    confirmationCode?: string;
    suggestedPrice?: number;
  }): string {
    const { restaurantName, date, time, partySize, platform, confirmationCode, suggestedPrice } = details;
    
    let message = `🎯 **ACQUISITION SUCCESS!**\n\n`;
    message += `✅ ${restaurantName}\n`;
    message += `📅 ${date} at ${time}\n`;
    message += `👥 ${partySize} guests\n`;
    message += `📱 ${platform}\n`;
    if (confirmationCode) {
      message += `🔑 Confirmation: ${confirmationCode}\n`;
    }
    message += `\n`;
    if (suggestedPrice) {
      message += `💰 Suggested AT Price: $${suggestedPrice}\n`;
    }
    message += `\n🚀 Ready to list on AppointmentTrader!`;
    
    return message;
  }
  
  /**
   * Format time string to readable format
   */
  private formatTime(time: string): string {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }
  
  /**
   * Get all template types
   */
  getTemplateTypes(): string[] {
    return [
      'transfer_instructions',
      'at_listing',
      'sale_confirmation',
      'follow_up',
      'drop_reminder',
      'acquisition_success',
    ];
  }
}

export default new CommunicationTemplates();

