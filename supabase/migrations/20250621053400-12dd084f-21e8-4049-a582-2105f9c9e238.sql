
-- Add RLS policy to allow auction admins to delete bids from their own auctions
CREATE POLICY "Auction admins can delete bids from their auctions" ON public.bids
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.auctions 
      WHERE auctions.id = bids.auction_id 
      AND auctions.admin_id = auth.uid()
    )
  );
