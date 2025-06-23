
-- Enable real-time for auction_results table
ALTER TABLE public.auction_results REPLICA IDENTITY FULL;

-- Add the table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_results;
