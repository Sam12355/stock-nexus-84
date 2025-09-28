-- Table to store moveout "list headers"
CREATE TABLE moveout_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id UUID REFERENCES managers(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT now()
);

-- Table to store items in each moveout list
CREATE TABLE moveout_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moveout_list_id UUID REFERENCES moveout_lists(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    available_amount INT NOT NULL,
    request_amount INT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);
