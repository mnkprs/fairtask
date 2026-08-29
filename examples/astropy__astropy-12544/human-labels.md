# astropy__astropy-12544 — human labels (OpenAI, 2024; max over three annotators)

Source: data/raw/ensembled_annotations_public.csv (provenance in data/raw/SOURCES.md); task: https://github.com/astropy/astropy/pull/12544

| axis | score |
|---|---|
| underspecified | 0 |
| false_negative | 3 |
| filter_out | true |

## Annotator note — issue

The problem described in the issue is that when `astropy.table.Table.read()` encounters values such as `NaN`, it automatically converts the table into a `MaskedTable` and the affected columns into `MaskedColumn`, which might break downstream tasks. The solution suggested is to have a parameter `mask` in `Table.read()`, which, when set to `False`, would not do the masking and return the table as-is.

## Annotator note — tests

The parameter introduced is `mask_invalid`, which is not what the issue asked for. Because the issue description explicitly mentioned it, any reasonable solution would add the parameter `mask` and so, would fail these tests.

Also, the tests only test this feature for the FITS file, which is not what the issue specified.

## Graded tests (FAIL_TO_PASS)

- `astropy/io/fits/tests/test_connect.py::TestSingleTable::test_mask_nans_on_read`
- `astropy/io/fits/tests/test_connect.py::TestSingleTable::test_mask_str_on_read`
