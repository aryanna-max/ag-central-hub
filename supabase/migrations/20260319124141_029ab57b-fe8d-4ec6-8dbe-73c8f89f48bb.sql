ALTER TABLE public.field_payment_items
  DROP CONSTRAINT IF EXISTS field_payment_items_payment_method_id_fkey;

ALTER TABLE public.field_payment_items
  ADD CONSTRAINT field_payment_items_payment_method_id_fkey
  FOREIGN KEY (payment_method_id) REFERENCES public.employee_payment_methods(id);