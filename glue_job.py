import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.dynamicframe import DynamicFrame
import logging

# Initialize logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Get job parameters
args = getResolvedOptions(sys.argv, ['JOB_NAME', 'TempDir'])

# Initialize Spark and Glue context
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

# Configure logging
logger.info(f"Starting Glue Job: {args['JOB_NAME']}")

try:
    # Define S3 input and output paths
    input_path = "s3://my-bucket/input/data/"
    output_path = "s3://my-bucket/output/processed/"
    
    logger.info(f"Reading data from: {input_path}")
    
    # Read data from S3 (CSV format)
    dyf = glueContext.create_dynamic_frame.from_options(
        format_options={"multiline": False},
        connection_type="s3",
        format="csv",
        connection_options={
            "paths": [input_path],
            "recurse": True,
        },
        transformation_ctx="input_dyf"
    )
    
    # Print schema
    dyf.printSchema()
    
    # Apply transformations
    logger.info("Applying data transformations...")
    
    # Remove null values
    dyf = dyf.dropnulls()
    
    # Filter records (example: filter out records with empty fields)
    dyf_filtered = dyf.filter(
        f=lambda x: all(v is not None and v != "" for v in x.values())
    )
    
    # Apply mapping transformations (optional)
    mapped_dyf = ApplyMapping.apply(
        frame=dyf_filtered,
        mappings=[
            ("col1", "string", "col1", "string"),
            ("col2", "string", "col2", "string"),
            ("col3", "int", "col3", "int"),
        ],
        transformation_ctx="mapped_dyf"
    )
    
    # Convert to Spark DataFrame for additional processing if needed
    df = mapped_dyf.toDF()
    
    # Example: Add a processing timestamp column
    from pyspark.sql.functions import current_timestamp
    df = df.withColumn("processing_date", current_timestamp())
    
    # Convert back to DynamicFrame
    output_dyf = DynamicFrame.fromDF(df, glueContext, "output_dyf")
    
    logger.info(f"Writing processed data to: {output_path}")
    
    # Write data to S3 (Parquet format for better compression)
    glueContext.write_dynamic_frame.from_options(
        frame=output_dyf,
        connection_type="s3",
        connection_options={
            "path": output_path,
            "partitionKeys": []
        },
        format="parquet",
        transformation_ctx="output_dyf"
    )
    
    logger.info(f"Successfully wrote {output_dyf.count()} records to {output_path}")
    
    # Commit the job
    job.commit()
    logger.info(f"Glue Job {args['JOB_NAME']} completed successfully")
    
except Exception as e:
    logger.error(f"Error in Glue Job: {str(e)}", exc_info=True)
    job.commit()
    raise
