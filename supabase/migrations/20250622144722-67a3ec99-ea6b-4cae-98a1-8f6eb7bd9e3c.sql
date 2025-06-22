
-- Remove the incorrect unique constraints from bids table
ALTER TABLE public.bids 
DROP CONSTRAINT IF EXISTS unique_bidder_name_per_auction;

ALTER TABLE public.bids 
DROP CONSTRAINT IF EXISTS unique_bidder_email_per_auction;

-- Add a proper unique constraint to prevent duplicate bids on the same item by the same bidder
ALTER TABLE public.bids 
ADD CONSTRAINT unique_bidder_item_per_auction 
UNIQUE (auction_id, item_id, bidder_name);
