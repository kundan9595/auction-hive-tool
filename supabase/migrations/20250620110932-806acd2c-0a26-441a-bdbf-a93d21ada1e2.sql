
-- Add quantity support to bids table
ALTER TABLE public.bids 
ADD COLUMN quantity_requested INTEGER NOT NULL DEFAULT 1,
ADD COLUMN price_per_unit DECIMAL(10,2) GENERATED ALWAYS AS (bid_amount / quantity_requested) STORED;

-- Add quantity and pricing columns to auction_results table
ALTER TABLE public.auction_results 
ADD COLUMN quantity_won INTEGER DEFAULT 1,
ADD COLUMN price_per_unit_paid DECIMAL(10,2),
ADD COLUMN original_bid_per_unit DECIMAL(10,2),
ADD COLUMN refund_amount DECIMAL(10,2) DEFAULT 0;

-- Update the unique constraint to allow multiple results per item (for partial fulfillment)
ALTER TABLE public.auction_results 
DROP CONSTRAINT IF EXISTS auction_results_auction_id_item_id_key;

-- Add a new unique constraint that includes bidder to allow multiple winners per item
ALTER TABLE public.auction_results 
ADD CONSTRAINT auction_results_auction_item_bidder_unique 
UNIQUE(auction_id, item_id, winner_name);

-- Create function to calculate average pricing for auction results
CREATE OR REPLACE FUNCTION public.calculate_average_auction_results(auction_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item_record RECORD;
    bid_record RECORD;
    remaining_inventory INTEGER;
    average_price DECIMAL(10,2);
    total_winning_amount DECIMAL(10,2);
    total_winning_quantity INTEGER;
BEGIN
    -- Clear existing results for this auction
    DELETE FROM public.auction_results WHERE auction_id = auction_id_param;
    
    -- Process each item in the auction
    FOR item_record IN 
        SELECT DISTINCT i.id as item_id, i.inventory, i.starting_bid
        FROM public.items i
        JOIN public.collections c ON c.id = i.collection_id
        WHERE c.auction_id = auction_id_param
    LOOP
        remaining_inventory := item_record.inventory;
        total_winning_amount := 0;
        total_winning_quantity := 0;
        
        -- First pass: determine winners and calculate totals
        FOR bid_record IN
            SELECT b.*, (b.bid_amount / b.quantity_requested) as price_per_unit
            FROM public.bids b
            JOIN public.items i ON i.id = b.item_id
            WHERE b.item_id = item_record.item_id 
            AND b.auction_id = auction_id_param
            AND (b.bid_amount / b.quantity_requested) >= item_record.starting_bid
            ORDER BY (b.bid_amount / b.quantity_requested) DESC, b.created_at ASC
        LOOP
            IF remaining_inventory <= 0 THEN
                EXIT;
            END IF;
            
            DECLARE
                quantity_to_allocate INTEGER;
            BEGIN
                quantity_to_allocate := LEAST(bid_record.quantity_requested, remaining_inventory);
                
                total_winning_amount := total_winning_amount + (bid_record.price_per_unit * quantity_to_allocate);
                total_winning_quantity := total_winning_quantity + quantity_to_allocate;
                remaining_inventory := remaining_inventory - quantity_to_allocate;
            END;
        END LOOP;
        
        -- Calculate average price only if there are winners
        IF total_winning_quantity > 0 THEN
            average_price := total_winning_amount / total_winning_quantity;
            
            -- Reset for second pass
            remaining_inventory := item_record.inventory;
            
            -- Second pass: create auction results with average pricing
            FOR bid_record IN
                SELECT b.*, (b.bid_amount / b.quantity_requested) as price_per_unit
                FROM public.bids b
                JOIN public.items i ON i.id = b.item_id
                WHERE b.item_id = item_record.item_id 
                AND b.auction_id = auction_id_param
                AND (b.bid_amount / b.quantity_requested) >= item_record.starting_bid
                ORDER BY (b.bid_amount / b.quantity_requested) DESC, b.created_at ASC
            LOOP
                IF remaining_inventory <= 0 THEN
                    EXIT;
                END IF;
                
                DECLARE
                    quantity_to_allocate INTEGER;
                    refund_per_unit DECIMAL(10,2);
                    total_refund DECIMAL(10,2);
                BEGIN
                    quantity_to_allocate := LEAST(bid_record.quantity_requested, remaining_inventory);
                    refund_per_unit := bid_record.price_per_unit - average_price;
                    total_refund := refund_per_unit * quantity_to_allocate;
                    
                    INSERT INTO public.auction_results (
                        auction_id,
                        item_id,
                        winning_bid_id,
                        winner_name,
                        winning_amount,
                        quantity_sold,
                        quantity_won,
                        price_per_unit_paid,
                        original_bid_per_unit,
                        refund_amount
                    ) VALUES (
                        auction_id_param,
                        item_record.item_id,
                        bid_record.id,
                        bid_record.bidder_name,
                        average_price * quantity_to_allocate,
                        quantity_to_allocate,
                        quantity_to_allocate,
                        average_price,
                        bid_record.price_per_unit,
                        total_refund
                    );
                    
                    remaining_inventory := remaining_inventory - quantity_to_allocate;
                END;
            END LOOP;
        END IF;
    END LOOP;
END;
$$;
